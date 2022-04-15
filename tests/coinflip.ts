import { packDataBytes } from '@taquito/michel-codec';
import {
  BigMapAbstraction,
  ContractAbstraction,
  MichelsonMap,
  TezosToolkit,
  ContractProvider
} from '@taquito/taquito';
import { Schema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import { michelson } from '../build/test_coinflip.json';
import { confirmOperation } from '../utils/confirmation';
import { initTezos } from '../utils/helpers';
import {
  BatchContentsEntry,
  cloneMichelsonMap,
  replaceAddressesWithBytes,
  sendBatch,
  sendSingle
} from './helpers';
import defaultStorage from "./storage/coinflip";
import { FA2 } from './helpers/FA2';

export type CoinSide = { head: {} } | { tail: {} };

interface TezAssetDescriptor {
  tez: {};
}

interface FA2TokenDescriptor {
  fA2: {
    address: string;
    id: BigNumber;
  }
}

export type AssetDescriptor = TezAssetDescriptor | FA2TokenDescriptor;

export interface Game {
  asset: AssetDescriptor;
  start: string;
  bid_size: BigNumber;
  bet_coin_side: CoinSide;
  result_coin_side: CoinSide | null;
}

export interface Asset {
  descriptor: AssetDescriptor;
  payout_quotient: BigNumber;
  bank: BigNumber;
  max_bet_percentage: BigNumber;
}

export interface CoinflipStorage {
  admin: string;
  server: string;
  games_counter: BigNumber,
  games: MichelsonMap<string, Game>; // BigNumber
  assets_counter: BigNumber;
  network_fee: BigNumber;
  asset_to_id: MichelsonMap<string, BigNumber>;
  id_to_asset: MichelsonMap<string, Asset>; // BigNumber
  network_bank: BigNumber;
}

type BigMapName = 'games' | 'asset_to_id' | 'id_to_asset';

interface RawCoinflipStorage extends Omit<
  CoinflipStorage,
  BigMapName
>, Record<BigMapName, BigMapAbstraction> {}

const assetDescriptorSchema = new Schema({
  prim: 'or',
  args: [
    {
      prim: 'pair',
      args: [
        { prim: 'address', annots: ['%address'] },
        { prim: 'nat', annots: ['%id'] }
      ],
      annots: ['%fA2']
    },
    { prim: 'unit', annots: ['%tez'] }
  ],
  annots: ['%asset']
});

export const TEZ_ASSET_DESCRIPTOR = { tez: {} };

export class Coinflip {
  constructor(
    private tezos: TezosToolkit,
    private contract: ContractAbstraction<ContractProvider>,
    public storage = defaultStorage
  ) {}

  get contractAddress() {
    return this.contract.address;
  }

  static async init(
    accountOrTezos: string | TezosToolkit,
    contract: string | ContractAbstraction<ContractProvider>
  ) {
    const tezos = typeof accountOrTezos === 'string'
      ? await initTezos(accountOrTezos)
      : accountOrTezos;

    return new Coinflip(
      tezos,
      typeof contract === 'string' ? await tezos.contract.at(contract) : contract
    );
  }

  static async originateWithTransfers(
    tezos: TezosToolkit,
    storage = defaultStorage
  ) {
    const operation = await tezos.contract.originate(
      { code: michelson, storage: storage }
    );
    await confirmOperation(tezos, operation.hash);

    const { contractAddress } = operation;
    let mutezToTransfer = new BigNumber(0);
    const unfoldedFa2Transfers: Array<
      { address: string; id: BigNumber; amount: BigNumber }
    > = [];
    for (const game of storage.games.values()) {
      const { asset, bid_size, result_coin_side } = game;
      if (result_coin_side !== null) {
        continue;
      }
      if ('tez' in asset) {
        mutezToTransfer = mutezToTransfer.plus(bid_size);
      } else {
        unfoldedFa2Transfers.push({ ...asset.fA2, amount: bid_size });
      }
    }
    for (const asset of storage.id_to_asset.values()) {
      const { descriptor, bank } = asset;
      if (bank.eq(0)) {
        continue;
      }
      if ('tez' in descriptor) {
        mutezToTransfer = mutezToTransfer.plus(bank);
      } else {
        unfoldedFa2Transfers.push({ ...descriptor.fA2, amount: bank });
      }
    }
    const foldedFa2Transfers = unfoldedFa2Transfers
      .reduce<Record<string, Record<string, BigNumber>>>(
        (acc, { address, id, amount }) => {
          const idKey = id.toFixed();
          if (!acc[address]) {
            acc[address] = {};
          }
          const oldValue = acc[address][idKey] ?? new BigNumber(0);
          acc[address][idKey] = oldValue.plus(amount);

          return acc;
        },
        {}
      );
    const contract = await tezos.contract.at(contractAddress);
    const setContractBalancesOperationsBatch: BatchContentsEntry[] = [];
    if (mutezToTransfer.gt(0)) {
      setContractBalancesOperationsBatch.push({
        method: contract.methods.do(),
        sendParams: { mutez: true, amount: mutezToTransfer.toNumber() }
      });
    }
    const accountPkh = await tezos.wallet.pkh();
    await Promise.all(
      Object.entries(foldedFa2Transfers).map(
        async ([tokenAddress, tokenTransfers]) => {
          const fa2 = await FA2.init(tokenAddress, tezos);
          setContractBalancesOperationsBatch.push(
            fa2.transfer([{
              from_: accountPkh,
              txs: Object.entries(tokenTransfers).map(([rawId, amount]) => ({
                to_: contractAddress,
                token_id: Number(rawId),
                amount: amount.toNumber()
              }))
            }])
          );
        }
      )
    );

    if (setContractBalancesOperationsBatch.length > 0) {
      await sendBatch(tezos, setContractBalancesOperationsBatch);
    }

    return new Coinflip(tezos, contract, storage);
  }

  async updateStorage(
    maps: Partial<Record<BigMapName, string[]>> = {}
  ) {
    const {
      games: oldGames,
      asset_to_id: oldAssetToId,
      id_to_asset: oldIdToAsset
    } = this.storage;
    const michelsonMaps = {
      games: cloneMichelsonMap(oldGames),
      asset_to_id: cloneMichelsonMap(oldAssetToId),
      id_to_asset: cloneMichelsonMap(oldIdToAsset)
    };
    const rawStorage = await this.contract.storage<RawCoinflipStorage>();
    await Promise.all(
      Object.keys(maps).map(async mapName => {
        const keysToUpdate = maps[mapName];
        if (keysToUpdate) {
          await Promise.all(keysToUpdate.map(async key => {
            const newValue = await rawStorage[mapName as BigMapName].get(key);
            if (newValue === undefined) {
              michelsonMaps[mapName].delete(key);
            } else {
              michelsonMaps[mapName].set(key, newValue);
            }
          }));
        }
      })
    );
    this.storage = {
      ...rawStorage,
      ...michelsonMaps
    };
  }

  async sendBatch(contents: BatchContentsEntry[]) {
    return sendBatch(this.tezos, contents);
  }

  async sendSingle(payload: BatchContentsEntry) {
    return sendSingle(this.tezos, payload);
  }

  static getAssetKey(asset: AssetDescriptor) {
    const keyToEncode = replaceAddressesWithBytes(
      assetDescriptorSchema.Encode(asset)
    );

    return packDataBytes(keyToEncode).bytes;
  }

  async updateAssetByDescriptor(descriptor: AssetDescriptor) {
    const assetKey = Coinflip.getAssetKey(descriptor);
    await this.updateStorage({ asset_to_id: [assetKey] });
    const assetId = this.storage.asset_to_id.get(assetKey);

    if (assetId) {
      await this.updateStorage({ id_to_asset: [assetId.toFixed()] });
    }
  }

  getAssetByDescriptor(descriptor: AssetDescriptor): Asset | undefined {
    const assetKey = Coinflip.getAssetKey(descriptor);
    const assetId = this.storage.asset_to_id.get(assetKey);
    
    if (!assetId) {
      return undefined;
    }

    return this.storage.id_to_asset.get(assetId.toFixed());
  }

  addAsset(
    payoutQuotient: BigNumber.Value,
    maxBetPercentage: BigNumber.Value,
    asset: AssetDescriptor
  ) {
    if ('tez' in asset) {
      return this.contract.methods.add_asset(
        payoutQuotient,
        maxBetPercentage,
        'tez'
      );
    }

    return this.contract.methods.add_asset(
      payoutQuotient,
      maxBetPercentage,
      'fA2',
      asset.fA2.address,
      asset.fA2.id
    );
  }

  private setAssetValue(
    methodName: string,
    assetId: BigNumber.Value,
    value: BigNumber.Value
  ) {
    return this.contract.methods[methodName](value, assetId);
  }

  setPayoutQuotient(assetId: BigNumber.Value, value: BigNumber.Value) {
    return this.setAssetValue('set_payout_quotient', assetId, value);
  }

  setMaxBet(assetId: BigNumber.Value, value: BigNumber.Value) {
    return this.setAssetValue('set_max_bet', assetId, value);
  }

  setNetworkFee(value: BigNumber.Value) {
    return this.contract.methods.set_network_fee(value);
  }

  addAssetBank(
    assetId: BigNumber.Value,
    amount: BigNumber.Value,
    tezAmount?: number
  ) {
    return {
      method: this.setAssetValue('add_asset_bank', assetId, amount),
      sendParams: tezAmount === undefined
        ? undefined
        : { mutez: true, amount: tezAmount }
    };
  }
}
