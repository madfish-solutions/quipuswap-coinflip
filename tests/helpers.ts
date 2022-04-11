import { ContractMethod, ContractProvider } from "@taquito/taquito";
import { rejects, strictEqual } from "assert";
import BigNumber from "bignumber.js";

type OperationResult = BigNumber.Value | { error: string };

const isErrorResult = (result: OperationResult): result is { error: string } =>
  typeof result === "object" && "error" in result;

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

export const nonOwnerTestcase = async (method: ContractMethod<ContractProvider>) => rejects(
  () => method.send(),
  (e: Error) => e.message === "Lottery/not-owner"
);

export const nonOracleTestcase = async (method: ContractMethod<ContractProvider>) => rejects(
  () => method.send(),
  (e: Error) => e.message === "Lottery/not-oracle"
);
