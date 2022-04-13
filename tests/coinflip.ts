import {
  MichelsonDataPair,
  MichelsonData,
  packDataBytes
} from '@taquito/michel-codec';
import { MichelsonV1ExpressionExtended } from '@taquito/rpc';
import {
  BigMapAbstraction,
  ContractAbstraction,
  ContractMethod,
  MichelsonMap,
  TezosToolkit,
  UnitValue,
  Wallet
} from "@taquito/taquito";
import { BigNumber } from "bignumber.js";
import { michelson } from '../build/coinflip.json';
import { confirmOperation } from "../utils/confirmation";
import { initTezos } from "../utils/helpers";
import { replaceAddressesWithBytes } from './helpers';

import defaultStorage from "./storage/coinflip";

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

export const TEZ_ASSET_DESCRIPTOR = { tez: {} };

export class Coinflip {
  constructor(
    private tezos: TezosToolkit,
    private contract: ContractAbstraction<Wallet>,
    public storage = defaultStorage
  ) {}

  static async init(
    accountOrTezos: string | TezosToolkit,
    contract: string | ContractAbstraction<Wallet>
  ) {
    const tezos = typeof accountOrTezos === 'string'
      ? await initTezos(accountOrTezos)
      : accountOrTezos;

    return new Coinflip(
      tezos,
      typeof contract === 'string' ? await tezos.wallet.at(contract) : contract
    );
  }

  static async originate(tezos: TezosToolkit, storage = defaultStorage) {
    const operation = await tezos.contract.originate(
      { code: michelson, storage: storage }
    );
    await confirmOperation(tezos, operation.hash);

    return new Coinflip(
      tezos,
      await tezos.wallet.at(operation.contractAddress),
      storage
    );
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
      games: oldGames,
      asset_to_id: oldAssetToId,
      id_to_asset: oldIdToAsset
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

  async sendBatch(methods: ContractMethod<Wallet>[]) {
    const batch = await this.tezos.wallet.batch([]);
    methods.forEach(method => batch.withTransfer(method.toTransferParams()));
    const op = await batch.send();
    await confirmOperation(this.tezos, op.opHash);

    return op;
  }

  async sendSingle(method: ContractMethod<Wallet>) {
    const op = await method.send();
    await confirmOperation(this.tezos, op.opHash);

    return op;
  }

  getAssetKey(asset: AssetDescriptor) {
    const addAssetTransferParams = this.addAsset(asset).toTransferParams();
    const paramsMichelson = addAssetTransferParams.parameter!.value as
      MichelsonV1ExpressionExtended;
    const toofta1 = packDataBytes(
      replaceAddressesWithBytes(paramsMichelson.args[0]) as
        MichelsonDataPair<MichelsonData[]>
    ).bytes;

    return toofta1;
  }

  async updateAssetByDescriptor(descriptor: AssetDescriptor) {
    const assetKey = this.getAssetKey(descriptor);
    await this.updateStorage({ asset_to_id: [assetKey] });
    const assetId = this.storage.asset_to_id.get(assetKey);

    if (assetId) {
      await this.updateStorage({ id_to_asset: [assetId.toFixed()] });
    }
  }

  getAssetByDescriptor(descriptor: AssetDescriptor): Asset | undefined {
    const assetKey = this.getAssetKey(descriptor);
    const assetId = this.storage.asset_to_id.get(assetKey);
    
    if (!assetId) {
      return undefined;
    }

    return this.storage.id_to_asset.get(assetId.toFixed());
  }

  addAsset(asset: AssetDescriptor) {
    if ('tez' in asset) {
      return this.contract.methods.add_asset('tez');
    }

    return this.contract.methods.add_asset(
      'fA2',
      asset.fA2.address,
      asset.fA2.id
    );
  }

  private setAssetValue(
    methodName: string,
    asset: AssetDescriptor,
    value: BigNumber
  ) {
    if ('tez' in asset) {
      return this.contract.methods[methodName](value, 'tez');
    }

    return this.contract.methods[methodName](
      value,
      'fA2',
      asset.fA2.address,
      asset.fA2.id
    );
  }

  setPayoutQuotient(asset: AssetDescriptor, value: BigNumber) {
    return this.setAssetValue('set_payout_quotient', asset, value);
  }

  setMaxBet(asset: AssetDescriptor, value: BigNumber) {
    return this.setAssetValue('set_max_bet', asset, value);
  }
}
