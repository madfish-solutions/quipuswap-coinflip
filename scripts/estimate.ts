// A code example for estimating entrypoints performance
import { confirmOperation } from '../utils/confirmation';
import { initTezos } from "../utils/helpers";
import { michelson as contractCode } from "../build/test_coinflip.json";
import defaultStorage from '../storage/coinflip';

(async () => {
  try {
    console.log("Initializing tezos toolkit...");
    const Tezos = await initTezos();
    console.log("Originating test contract...");
    const operation = await Tezos.wallet.originate({
      code: contractCode,
      storage: defaultStorage
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
    } = await Tezos.estimate.transfer(contract.methods.do().toTransferParams());

    console.log(`Suggested fee: ${suggestedFeeMutez / 1e6} tez`);
    console.log(
      `Storage fee: ${minimalFeePerStorageByteMutez * storageLimit / 1e6} tez`
    );
  } catch (e) {
    console.error(e);
  }
})();
