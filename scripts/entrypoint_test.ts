// An example of code which can be used for debugging of test code using taquito module
import { confirmOperation } from '../utils/confirmation';
import { initTezos } from "../utils/helpers";
import { michelson as contractCode } from "../build/lottery.json";
import { alice } from "./sandbox/accounts";

(async () => {
  try {
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
    console.log(contract.entrypoints, contract.schema);

    const method = await contract.methods.add_memory("memory_keyboard", 4);
    console.log(method.toTransferParams());
  } catch (e) {
    console.error(e);
  }
})();
