import { ContractMethod, Wallet } from '@taquito/taquito';
import { b58decode, validateContractAddress, ValidationResult } from '@taquito/utils';
import { MichelsonV1Expression, MichelsonV1ExpressionExtended } from '@taquito/rpc';
import { rejects } from 'assert';

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
