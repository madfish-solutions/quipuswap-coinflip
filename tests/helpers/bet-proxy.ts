import {
  TezosToolkit,
  OriginationOperation,
  Contract,
  ContractMethod,
  ContractProvider
} from "@taquito/taquito";
import BigNumber from 'bignumber.js';

import { confirmOperation } from "../../scripts/confirmation";
import { CoinSide } from "../coinflip";
import { michelson } from '../../build/bet_proxy.json';
import {
  BatchContentsEntry,
  sendBatch,
  sendSingle
} from "../helpers";

export interface BetProxyStorage {
  gamble_address: string
}

export class BetProxy {
  constructor(
    public contract: Contract,
    public tezos: TezosToolkit,
    public storage: BetProxyStorage
  ) {}

  static async init(address: string, tezos: TezosToolkit) {
    const contract = await tezos.contract.at(address);
    return new BetProxy(contract, tezos, await contract.storage());
  }

  static async originate(
    tezos: TezosToolkit,
    storage: BetProxyStorage
  ) {
    const operation: OriginationOperation = await tezos.contract
      .originate({ code: michelson, storage: storage });

    await confirmOperation(tezos, operation.hash);

    return new BetProxy(
      await tezos.contract.at(operation.contractAddress),
      tezos,
      storage
    );
  }

  async updateStorage() {
    this.storage = await this.contract.storage();
  }

  sendBatch(contents: BatchContentsEntry[]) {
    return sendBatch(this.tezos, contents);
  }

  sendSingle(method: ContractMethod<ContractProvider>) {
    return sendSingle(this.tezos, method);
  }

  proxyBet(
    assetId: BigNumber.Value,
    bidSize: BigNumber.Value,
    coinSide: CoinSide,
    mutezAmount: number
  ) {
    return { 
      method: this.contract.methods.default(
        assetId,
        bidSize,
        'head' in coinSide ? 'head' : 'tail'
      ),
      sendParams: { mutez: true, amount: mutezAmount }
    };
  }
}
