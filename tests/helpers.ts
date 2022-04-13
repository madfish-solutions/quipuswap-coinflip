import { ContractMethod, Wallet } from '@taquito/taquito';
import { b58decode, validateContractAddress, ValidationResult } from '@taquito/utils';
import { MichelsonV1Expression, MichelsonV1ExpressionExtended } from '@taquito/rpc';
import { rejects, strictEqual } from 'assert';
import BigNumber from 'bignumber.js';

type OperationResult = BigNumber.Value | { error: string };

const isErrorResult = (result: OperationResult): result is { error: string } =>
  typeof result === 'object' && 'error' in result;

const assertResultMatch = (expected: OperationResult, received: OperationResult) => {
  if (isErrorResult(expected) && isErrorResult(received)) {
    strictEqual(
      expected.error,
      received.error,
      `Expected to fail with error '${expected.error}' but failed with error '${received.error}'`
    );
  } else if (isErrorResult(expected)) {
    throw new Error(
      `Expected to fail with error '${expected.error}' but received result ${received.toString()}`
    );
  } else if (isErrorResult(received)) {
    throw new Error(
      `Expected to receive result ${expected.toString()} but failed with error '${received.error}'`
    );
  } else {
    strictEqual(new BigNumber(received).toFixed(), new BigNumber(expected).toFixed());
  }
};

export const entrypointErrorTestcase = async (
  method: ContractMethod<Wallet>,
  expectedError: string
) => rejects(async () => method.send(), (e: Error) => e.message === expectedError);

export const notAdminTestcase = async (
  method: ContractMethod<Wallet>
) => entrypointErrorTestcase(method, 'Coinflip/not-admin');

export const notServerTestcase = async (
  method: ContractMethod<Wallet>
) => entrypointErrorTestcase(method, 'Coinflip/not-server');

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
