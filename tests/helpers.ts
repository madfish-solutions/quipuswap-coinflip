import {
  ContractMethod,
  TezosToolkit,
  ContractProvider,
  WalletOperationBatch,
  WalletTransferParams,
  TransactionOperation,
  MichelsonMap,
  SendParams
} from '@taquito/taquito';
import { MichelsonMapKey } from '@taquito/michelson-encoder';
import {
  b58decode,
  validateContractAddress,
  ValidationResult
} from '@taquito/utils';
import {
  METADATA_BALANCE_UPDATES_CATEGORY,
  MichelsonV1Expression,
  MichelsonV1ExpressionExtended
} from '@taquito/rpc';
import { strictEqual, rejects } from 'assert';
import BigNumber from 'bignumber.js';

import { confirmOperation } from '../utils/confirmation';
import { Asset, Coinflip, CoinflipStorage } from './coinflip';
import defaultStorage from './storage/coinflip';
import { CoinflipType } from './account-contracts-proxies';

export type BatchContentsEntry = 
  | ContractMethod<ContractProvider>
  | {
    method: ContractMethod<ContractProvider>;
    sendParams?: Partial<SendParams>
  };

export function replaceAddressesWithBytes(expr: MichelsonV1Expression) {
  if (expr instanceof Array) {
    return expr.map(value => replaceAddressesWithBytes(value));
  }
  if ('string' in expr) {
    if (validateContractAddress(expr.string) === ValidationResult.VALID) {
      return { bytes: b58decode(expr.string) };
    }
  }
  if ('int' in expr || 'bytes' in expr) {
    return expr;
  }

  const extendedExpr = expr as MichelsonV1ExpressionExtended;

  return {
    ...extendedExpr,
    args: extendedExpr.args && replaceAddressesWithBytes(extendedExpr.args)
  };
}

type ReturnPromiseValue<T> = T extends (...args: any[]) => Promise<infer U>
  ? U
  : never;

export type BatchWalletOperation = ReturnPromiseValue<
  WalletOperationBatch['send']
>;

async function sendWithConfirmation(
  tezos: TezosToolkit,
  batch: WalletOperationBatch
): Promise<BatchWalletOperation>;
async function sendWithConfirmation(
  tezos: TezosToolkit,
  payload: BatchContentsEntry,
): Promise<TransactionOperation>;
async function sendWithConfirmation(
  tezos: TezosToolkit,
  batchOrPayload: WalletOperationBatch | BatchContentsEntry,
) {
  let op: TransactionOperation | BatchWalletOperation;
  if ('method' in batchOrPayload) {
    op = await batchOrPayload.method.send(batchOrPayload.sendParams);
  } else {
    op = await batchOrPayload.send();
  }

  await confirmOperation(
    tezos,
    op instanceof TransactionOperation ? op.hash : op.opHash
  );

  return op;
}

export async function sendBatch(
  tezos: TezosToolkit,
  contents: BatchContentsEntry[]
) {
  const batch = contents.reduce(
    (prevBatch, entry) => {
      let params: WalletTransferParams;
      if (entry instanceof ContractMethod) {
        params = entry.toTransferParams();
      } else {
        params = entry.method.toTransferParams(entry.sendParams);
      }
      return prevBatch.withTransfer(params);
    },
    await tezos.wallet.batch([])
  );

  return sendWithConfirmation(tezos, batch);
}

export async function sendSingle(
  tezos: TezosToolkit,
  payload: BatchContentsEntry
) {
  return sendWithConfirmation(tezos, payload);
}

export const makeStorage = (
  assets: Asset[] = [],
  networkBank: BigNumber.Value = 0,
  networkFee: BigNumber.Value = defaultStorage.network_fee
): CoinflipStorage => ({
  ...defaultStorage,
  network_fee: new BigNumber(networkFee),
  network_bank: new BigNumber(networkBank),
  assets_counter: new BigNumber(assets.length),
  asset_to_id: MichelsonMap.fromLiteral(
    Object.fromEntries(
      assets.map((asset, index) => [
        Coinflip.getAssetKey(asset.descriptor),
        new BigNumber(index)
      ])
    )
  ) as CoinflipStorage['asset_to_id'],
  id_to_asset: MichelsonMap.fromLiteral(
    Object.fromEntries(assets.map((asset, index) => [index.toString(), asset]))
  ) as CoinflipStorage['id_to_asset']
});

export function cloneMichelsonMap<Key extends MichelsonMapKey, Value>(
  map: MichelsonMap<Key, Value>
) {
  const result = new MichelsonMap<Key, Value>();
  for (const entry of map.entries()) {
    result.set(entry[0], entry[1]);
  }
  return result;
}

export async function getTotalFee(
  op: BatchWalletOperation | TransactionOperation
) {
  const operationResults = op instanceof TransactionOperation
    ? op.operationResults
    : await op.operationResults();

  return operationResults.reduce(
    (sum, result) => {
      let resultFee = 0;
      if ('metadata' in result &&
        'operation_result' in result.metadata &&
        'balance_updates' in result.metadata.operation_result) {
        const { balance_updates } = result.metadata.operation_result;
        resultFee += balance_updates
          .filter(
            ({ category }) =>
              category === METADATA_BALANCE_UPDATES_CATEGORY.STORAGE_FEES
          )
          .reduce(
            (storageFeeSum, { change }) => storageFeeSum + Number(change),
            0
          );
      }
      if ('fee' in result) {
        resultFee += Number(result.fee);
      }

      return sum + resultFee;
    },
    0
  );
}

export const assertNumberValuesEquality = (
  actual: BigNumber.Value,
  expected: BigNumber.Value,
  message?: string | Error
) => {
  strictEqual(
    new BigNumber(actual).toFixed(),
    new BigNumber(expected).toFixed(),
    message
  );
}

export const entrypointErrorTestcase = async (
  payload: BatchContentsEntry,
  expectedError: string,
) => rejects(
  async () => 'method' in payload
    ? payload.method.send(payload.sendParams)
    : payload.send(),
  (e: Error) => e.message === expectedError
);

export const notAdminTestcase = async (payload: BatchContentsEntry) =>
  entrypointErrorTestcase(payload, 'Coinflip/not-admin');

export const notServerTestcase = async (payload: BatchContentsEntry) =>
  entrypointErrorTestcase(payload, 'Coinflip/not-server');

export async function adminErrorTestcase(
  accountsContractsProxies: Record<string, Coinflip>,
  methodFn: (coinflip: Coinflip) => BatchContentsEntry,
  expectedError: string
) {
  const coinflip = accountsContractsProxies.alice;

  await entrypointErrorTestcase(methodFn(coinflip), expectedError);
}
