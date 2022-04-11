import {
  BigMapAbstraction,
  ContractAbstraction,
  ContractMethod,
  ContractProvider,
  MichelsonMap,
  TezosToolkit,
  UnitValue
} from "@taquito/taquito";
import { BigNumber } from "bignumber.js";
import { confirmOperation } from "../utils/confirmation";
import { initTezos } from "../utils/helpers";

import defaultStorage from "./storage/storage";

export type GameState = Record<'pending' | 'won' | 'lost' | 'canceled', {}>;

export interface Game {
  start : string;
  bet : BigNumber;
  state : GameState;
}

export interface LotteryStorage {
  admin: string;
  oracle: string;
  gas_comission: number;
  payout: BigNumber;
  win_percentage: BigNumber;
  token_address: string;
  games_count: BigNumber;
  games: MichelsonMap<string, Game>;
}

interface RawLotteryStorage extends Omit<LotteryStorage, 'games'> {
  games: BigMapAbstraction;
}

export class Lottery {
  storage: LotteryStorage = defaultStorage as LotteryStorage;

  constructor(
    private tezos: TezosToolkit,
    private contract: ContractAbstraction<ContractProvider>
  ) {}

  static async init(accountAlias: string, contractAddress: string) {
    const tezos = await initTezos(accountAlias);

    return new Lottery(tezos, await tezos.contract.at(contractAddress));
  }

  async updateStorage(
    maps: { games?: string[] } = {}
  ) {
    const michelsonMaps = {
      games: this.storage.games
    };
    michelsonMaps.games.set
    const rawStorage = await this.contract.storage<RawLotteryStorage>();
    const bigmaps = {
      games: rawStorage.games
    };
    await Promise.all(
      Object.keys(maps).map(async mapName => {
        const keysToUpdate = maps[mapName];
        if (keysToUpdate) {
          await Promise.all(keysToUpdate.map(async key => {
            const newValue = await bigmaps[key].get(key);
            if (newValue) {
              michelsonMaps[mapName].set(key, newValue);
            } else {
              michelsonMaps[mapName].delete(key);
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

  async sendBatch(methods: ContractMethod<ContractProvider>[]) {
    const batch = await this.tezos.wallet.batch([]);
    methods.forEach(method => batch.withTransfer(method.toTransferParams()));
    const op = await batch.send();
    await confirmOperation(this.tezos, op.opHash);

    return op;
  }

  async sendSingle(method: ContractMethod<ContractProvider>) {
    const op = await method.send();
    await confirmOperation(this.tezos, op.hash);

    return op;
  }
}
