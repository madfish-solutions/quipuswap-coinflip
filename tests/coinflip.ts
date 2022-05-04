import {
  BigMapAbstraction,
  ContractAbstraction,
  MichelsonMap,
  TezosToolkit,
  ContractProvider
} from '@taquito/taquito';
import { BigNumber } from 'bignumber.js';

import { michelson } from '../build/test_coinflip.json';
import { confirmOperation } from '../utils/confirmation';
import { initTezos } from '../utils/helpers';
import {
  BatchContentsEntry,
  cloneMichelsonMap,
  sendBatch,
  sendSingle
} from './helpers';
import defaultStorage from "./storage/coinflip";
import { FA2 } from './helpers/FA2';
import { getAssetKey } from '../utils/byte-keys';

export type CoinSide = { head: Symbol } | { tail: Symbol };

export type Status = { started: Symbol } | { won: Symbol } | { lost: Symbol };

interface TezAsset {
  tez: Symbol;
}

interface FA2TokenAsset {
  fa2: {
    address: string;
    id: BigNumber;
  }
}

export type Asset = TezAsset | FA2TokenAsset;

export interface Game {
  asset_id: BigNumber;
  gamer: string;
  start: string;
  bid_size: BigNumber;
  bet_coin_side: CoinSide;
  status: Status;
}

export interface AssetRecord {
  asset: Asset;
  payout_quot_f: BigNumber;
  bank: BigNumber;
  max_bet_percent_f: BigNumber;
  total_won_amt: BigNumber;
  total_lost_amt: BigNumber;
  total_bets_amt: BigNumber;
  games_count: BigNumber;
  paused: boolean;
}

export interface GamerStats {
  last_game_id: BigNumber;
  games_count: BigNumber;
  total_won_amt: BigNumber;
  total_lost_amt: BigNumber;
  total_bets_amt: BigNumber;
}

export interface CoinflipStorage {
  admin: string;
  server: string;
  games_counter: BigNumber,
  games: MichelsonMap<string, Game>;
  assets_counter: BigNumber;
  network_fee: BigNumber;
  asset_to_id: MichelsonMap<string, BigNumber>;
  id_to_asset: MichelsonMap<string, AssetRecord>;
  gamers_stats: MichelsonMap<string, GamerStats>;
  network_bank: BigNumber;
}

type BigMapName = 'games' | 'asset_to_id' | 'id_to_asset' | 'gamers_stats';

interface RawCoinflipStorage extends Omit<
  CoinflipStorage,
  BigMapName
>, Record<BigMapName, BigMapAbstraction> {}

export const TEZ_ASSET = { tez: Symbol() };

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
    let mutezToTransfer = storage.network_bank;
    const unfoldedFa2Transfers: Array<
      { address: string; id: BigNumber; amount: BigNumber }
    > = [];
    for (const game of storage.games.values()) {
      const { asset_id, bid_size, status } = game;
      const { asset } = storage.id_to_asset.get(asset_id.toFixed());
      if (!('started' in status)) {
        continue;
      }
      if ('tez' in asset) {
        mutezToTransfer = mutezToTransfer.plus(bid_size);
      } else {
        unfoldedFa2Transfers.push({ ...asset.fa2, amount: bid_size });
      }
    }
    for (const assetRecord of storage.id_to_asset.values()) {
      const { asset, bank } = assetRecord;
      if (bank.eq(0)) {
        continue;
      }
      if ('tez' in asset) {
        mutezToTransfer = mutezToTransfer.plus(bank);
      } else {
        unfoldedFa2Transfers.push({ ...asset.fa2, amount: bank });
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
      id_to_asset: oldIdToAsset,
      gamers_stats: oldGamersStats
    } = this.storage;
    const michelsonMaps = {
      games: cloneMichelsonMap(oldGames),
      asset_to_id: cloneMichelsonMap(oldAssetToId),
      id_to_asset: cloneMichelsonMap(oldIdToAsset),
      gamers_stats: cloneMichelsonMap(oldGamersStats)
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

  async updateAssetRecord(asset: Asset) {
    const assetKey = getAssetKey(asset);
    await this.updateStorage({ asset_to_id: [assetKey] });
    const assetId = this.storage.asset_to_id.get(assetKey);

    if (assetId) {
      await this.updateStorage({ id_to_asset: [assetId.toFixed()] });
    }
  }

  getAssetRecord(asset: Asset): AssetRecord | undefined {
    const assetKey = getAssetKey(asset);
    const assetId = this.storage.asset_to_id.get(assetKey);
    
    if (!assetId) {
      return undefined;
    }

    return this.storage.id_to_asset.get(assetId.toFixed());
  }

  getBankAmount(assetId: BigNumber.Value) {
    return this.storage.id_to_asset.get(new BigNumber(assetId).toFixed()).bank;
  }

  addAsset(
    payoutQuotient: BigNumber.Value,
    maxBetPercentage: BigNumber.Value,
    asset: Asset
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
      'fa2',
      asset.fa2.address,
      asset.fa2.id
    );
  }

  private setSingleAssetValueMethod(
    methodName: string,
    assetId: BigNumber.Value,
    value: BigNumber.Value
  ) {
    return this.contract.methods[methodName](value, assetId);
  }

  setPayoutQuotient(assetId: BigNumber.Value, value: BigNumber.Value) {
    return this.setSingleAssetValueMethod('set_payout_quotient', assetId, value);
  }

  setMaxBet(assetId: BigNumber.Value, value: BigNumber.Value) {
    return this.setSingleAssetValueMethod('set_max_bet', assetId, value);
  }

  setNetworkFee(value: BigNumber.Value) {
    return this.contract.methods.set_network_fee(value);
  }

  addAssetBank(
    assetId: BigNumber.Value,
    amount: BigNumber.Value,
    mutezAmount?: number
  ) {
    return {
      method: this.setSingleAssetValueMethod('add_asset_bank', assetId, amount),
      sendParams: mutezAmount === undefined
        ? undefined
        : { mutez: true, amount: mutezAmount }
    };
  }

  removeAssetBank(assetId: BigNumber.Value, amount: BigNumber.Value) {
    return this.setSingleAssetValueMethod(
      'remove_asset_bank',
      assetId,
      amount
    );
  }

  withdrawNetworkFee(value: BigNumber.Value) {
    return this.contract.methods.withdraw_network_fee(value);
  }

  setAdmin(value: string) {
    return this.contract.methods.set_admin(value);
  }

  setServer(value: string) {
    return this.contract.methods.set_server(value);
  }

  bet(
    assetId: BigNumber.Value,
    bidSize: BigNumber.Value,
    coinSide: CoinSide,
    mutezAmount: number
  ) {
    return {
      method: this.contract.methods.bet(
        assetId,
        bidSize,
        'head' in coinSide ? 'head' : 'tail'
      ),
      sendParams: { mutez: true, amount: mutezAmount }
    };
  }

  reveal(
    reveals: { game_id: BigNumber.Value, random_value: BigNumber.Value }[]
  ) {
    return this.contract.methods.reveal(reveals);
  }

  setPaused(assetId: BigNumber.Value, paused: boolean) {
    return this.contract.methods.set_paused(assetId, paused);
  }
}
