// A code example for estimating entrypoints performance
import { confirmOperation } from '../utils/confirmation';
import { initTezos } from "../utils/helpers";
import { michelson as contractCode } from "../build/calculator.json";
import { alice } from "./sandbox/accounts";

(async () => {
  console.log("Initializing tezos toolkit...");
  const Tezos = await initTezos();
  console.log("Originating test contract...");
  const operation = await Tezos.wallet.originate({
    code: contractCode,
    storage: { owner: alice.pkh, display_value: 0, memory_value: 0 }
  }).send();

  console.log("Waiting for confirmation...");
  await confirmOperation(Tezos, operation.opHash);

  const contract = await operation.contract();
  console.log(`Contract address is ${contract.address}`);
  console.log("Estimating operation...");
  const {
    storageLimit,
    suggestedFeeMutez,
    // @ts-ignore
    minimalFeePerStorageByteMutez
  } = await Tezos.estimate.transfer(
    contract.methods.sqrt("keyboard", "2838143136774604646417234884035774")
      .toTransferParams()
  );

  console.log(`Suggested fee: ${suggestedFeeMutez / 1e6} tez`);
  console.log(`Storage fee: ${minimalFeePerStorageByteMutez * storageLimit / 1e6} tez`);
})();
