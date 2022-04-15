import {
  TezosToolkit,
  OriginationOperation,
  Contract,
  ContractMethod,
  ContractProvider,
  BigMapAbstraction
} from "@taquito/taquito";

import { confirmOperation } from "../../scripts/confirmation";
import { michelson } from '../contracts/fa2.json';
import {
  BatchContentsEntry,
  cloneMichelsonMap,
  sendBatch,
  sendSingle
} from "../helpers";
import { fa2Storage as defaultStorage } from '../storage/fa2';

import {
  UpdateOperatorParam,
  MintGovTokenParams,
  TransferParam,
  FA2Storage,
  Minter,
} from "../types/FA2";

type BigMapName =
  | 'account_info'
  | 'token_info'
  | 'metadata'
  | 'token_metadata'
  | 'minters_info'
  | 'permits';

interface RawFA2Storage extends Omit<
  FA2Storage,
  BigMapName
>, Record<BigMapName, BigMapAbstraction> {}

export class FA2 {
  constructor(
    public contract: Contract,
    public tezos: TezosToolkit,
    public storage = defaultStorage
  ) {}

  static async init(fa2Address: string, tezos: TezosToolkit): Promise<FA2> {
    return new FA2(await tezos.contract.at(fa2Address), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: FA2Storage
  ): Promise<FA2> {
    const operation: OriginationOperation = await tezos.contract
      .originate({ code: michelson, storage: storage });

    await confirmOperation(tezos, operation.hash);

    return new FA2(await tezos.contract.at(operation.contractAddress), tezos);
  }

  async updateStorage(
    maps: Partial<Record<BigMapName, string[]>> = {}
  ) {
    const {
      account_info: oldAccountInfo,
      token_info: oldTokenInfo,
      metadata: oldMetadata,
      token_metadata: oldTokenMetadata,
      minters_info: oldMintersInfo,
      permits: oldPermits,
    } = this.storage;
    const michelsonMaps = {
      account_info: cloneMichelsonMap(oldAccountInfo),
      token_info: cloneMichelsonMap(oldTokenInfo),
      metadata: cloneMichelsonMap(oldMetadata),
      token_metadata: cloneMichelsonMap(oldTokenMetadata),
      minters_info: cloneMichelsonMap(oldMintersInfo),
      permits: cloneMichelsonMap(oldPermits)
    };
    const rawStorage = await this.contract.storage<RawFA2Storage>();
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

  getTokenBalance(accountPkh: string, tokenId: string) {
    return this.storage.account_info.get(accountPkh).balances.get(tokenId);
  }

  sendBatch(contents: BatchContentsEntry[]) {
    return sendBatch(this.tezos, contents);
  }

  sendSingle(method: ContractMethod<ContractProvider>) {
    return sendSingle(this.tezos, method);
  }

  transfer(params: TransferParam[]) {
    return this.contract.methods.transfer(params);
  }

  updateOperators(updateOperatorsParams: UpdateOperatorParam[]) {
    return this.contract.methods.update_operators(updateOperatorsParams);
  }

  setMinters(minters: Minter[]) {
    return this.contract.methods.set_minters(minters);
  }

  mintGovToken(mintGovTokenParams: MintGovTokenParams[]) {
    return this.contract.methods.mint_gov_token(mintGovTokenParams);
  }
}
