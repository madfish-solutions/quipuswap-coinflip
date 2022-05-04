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
  validateAddress,
  ValidationResult
} from '@taquito/utils';
import {
  InternalOperationResult,
  MichelsonV1Expression,
  MichelsonV1ExpressionExtended,
} from '@taquito/rpc';
import { rejects } from 'assert';
import BigNumber from 'bignumber.js';

import { confirmOperation } from '../utils/confirmation';
import { Coinflip, CoinflipStorage } from './coinflip';
import { FA2 } from './helpers/FA2';
import accounts from '../scripts/sandbox/accounts';
import { defaultFA2AssetId, defaultFA2TokenId, tezAssetId } from './constants';

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
  if (
    'string' in expr &&
    (validateAddress(expr.string) === ValidationResult.VALID)
  ) {
    return { bytes: b58decode(expr.string) };
  }
  if ('int' in expr || 'bytes' in expr || 'string' in expr) {
    return expr;
  }

  const extendedExpr = expr as MichelsonV1ExpressionExtended;
  if ('args' in extendedExpr) {
    extendedExpr.args = replaceAddressesWithBytes(extendedExpr.args); 
  }

  return extendedExpr;
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
  payload: BatchContentsEntry
): Promise<TransactionOperation>;
async function sendWithConfirmation(
  tezos: TezosToolkit,
  batchOrPayload: WalletOperationBatch | BatchContentsEntry
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
  payload: BatchContentsEntry,
) {
  return sendWithConfirmation(tezos, payload);
}

export function cloneMichelsonMap<Key extends MichelsonMapKey, Value>(
  map: MichelsonMap<Key, Value>
) {
  const result = new MichelsonMap<Key, Value>();
  for (const entry of map.entries()) {
    result.set(entry[0], entry[1]);
  }
  return result;
}

function addResultToTezBalancesDiffs(
  diffs: Record<string, BigNumber>,
  { amount, source, destination }: Pick<
    InternalOperationResult,
    'amount' | 'source' | 'destination'
  >
) {
  diffs[source] = (diffs[source] ?? new BigNumber(0)).minus(amount ?? 0);
  diffs[destination] = (diffs[destination] ?? new BigNumber(0))
    .plus(amount ?? 0);
}

async function getTezBalancesDiffs(
  op: BatchWalletOperation | TransactionOperation
) {
  const operationResults = op instanceof TransactionOperation
    ? op.operationResults
    : await op.operationResults();

  return operationResults.reduce<Record<string, BigNumber>>(
    (acc, result) => {
      if ('amount' in result) {
        addResultToTezBalancesDiffs(acc, result);
      }

      if ('metadata' in result &&
        'internal_operation_results' in result.metadata) {
        const { internal_operation_results } = result.metadata;

        internal_operation_results.forEach(
          (result) => {
            addResultToTezBalancesDiffs(acc, result);
          }
        )
      }

      return acc;
    },
    {}
  );
}

export const expectNumberValuesEquality = (
  actual: BigNumber.Value,
  expected: BigNumber.Value
) => {
  expect(new BigNumber(actual).toFixed()).toEqual(
    new BigNumber(expected).toFixed()
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

export async function serverErrorTestcase(
  accountsContractsProxies: Record<string, Coinflip>,
  methodFn: (coinflip: Coinflip) => BatchContentsEntry,
  expectedError: string
) {
  const coinflip = accountsContractsProxies.bob;

  await entrypointErrorTestcase(methodFn(coinflip), expectedError);
}

export type ExpectedBalancesDiffs = Record<
  string,
  Record<'tez' | 'fa2', BigNumber.Value>
>;

export const CONTRACT_ALIAS = 'contract';

export async function testcaseWithBalancesDiff(
  fa2Wrappers: Record<string, FA2>,
  coinflips: Record<string, Coinflip>,
  expectedBalancesDiffs: ExpectedBalancesDiffs,
  operation: (userCoinflip: Coinflip, userFa2: FA2) => Promise<
    BatchWalletOperation | TransactionOperation
  >,
  otherAssertions: (
    prevStorage: CoinflipStorage,
    userCoinflip: Coinflip
  ) => void | Promise<void>,
  userAlias = 'alice'
) {
  const fa2 = fa2Wrappers[userAlias];
  const coinflip = coinflips[userAlias];
  const ownersAliases = Object.keys(expectedBalancesDiffs);
  const ownersAddresses: string[] = ownersAliases.map(
    alias => alias === CONTRACT_ALIAS
      ? coinflip.contractAddress
      : accounts[alias].pkh
  );
  const gamersAliases = ownersAliases.filter(alias => alias !== CONTRACT_ALIAS);
  const gamersAddresses = gamersAliases.map(alias => accounts[alias].pkh);
  await Promise.all([
    fa2.updateStorage({ account_info: ownersAddresses }),
    ...gamersAliases.map(
      alias => coinflips[alias].updateStorage({
        id_to_asset: [tezAssetId, defaultFA2AssetId],
        gamers_stats: gamersAddresses
          .map(
            gamerAddress => [tezAssetId, defaultFA2AssetId].map(
              assetId => Coinflip.getAccountAssetIdPairKey(
                gamerAddress,
                assetId
              )
            )
          )
          .flat()
      })
    )
  ]);
  const { storage: prevStorage } = coinflip;
  const oldFa2Balances: Record<string, BigNumber> = Object.fromEntries(
    ownersAliases.map((alias, index) => [
      alias,
      fa2.getTokenBalance(ownersAddresses[index], String(defaultFA2TokenId))
    ])
  );

  const op = await operation(coinflip, fa2);

  await Promise.all([
    fa2.updateStorage({ account_info: ownersAddresses }),
    ...gamersAliases.map(
      alias => coinflips[alias].updateStorage({
        id_to_asset: [tezAssetId, defaultFA2AssetId],
        gamers_stats: gamersAddresses
          .map(
            gamerAddress => [tezAssetId, defaultFA2AssetId].map(
              assetId => Coinflip.getAccountAssetIdPairKey(
                gamerAddress,
                assetId
              )
            )
          )
          .flat()
      })
    )
  ]);
  const newFa2Balances: Record<string, BigNumber> = Object.fromEntries(
    ownersAliases.map((alias, index) => [
      alias,
      fa2.getTokenBalance(ownersAddresses[index], String(defaultFA2TokenId))
    ])
  );
  const actualTezBalancesDiffs = await getTezBalancesDiffs(op);

  const bigNumExpectedBalancesDiffs = Object.fromEntries(
    Object.entries(expectedBalancesDiffs).map(
      ([alias, { tez, fa2 }]) => [
        alias,
        { tez: new BigNumber(tez), fa2: new BigNumber(fa2) }
      ]
    )
  );
  const actualBalancesDiffs = Object.fromEntries(
    ownersAliases.map(alias => {
      const prevFa2Balance = oldFa2Balances[alias];
      const newFa2Balance = newFa2Balances[alias];
      const pkh = alias === CONTRACT_ALIAS
        ? coinflip.contractAddress
        : accounts[alias].pkh;

      return [
        alias,
        {
          tez: actualTezBalancesDiffs[pkh] ?? new BigNumber(0),
          fa2: newFa2Balance.minus(prevFa2Balance)
        }
      ];
    })
  );

  expect(actualBalancesDiffs).toEqual(bigNumExpectedBalancesDiffs);

  await otherAssertions(prevStorage, coinflip);
}
