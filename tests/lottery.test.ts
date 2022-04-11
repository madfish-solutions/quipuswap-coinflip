import { strictEqual } from 'assert';

import { migrate } from "../scripts/helpers";
import { Tezos, signerAlice } from "./utils/cli";
import { Lottery } from "./lottery";
import initialStorage from "./storage/storage";

describe("Calculator math entrypoints test", function () {
  let aliceLottery: Lottery;
  let bobLottery: Lottery;
  let carolLottery: Lottery;

  beforeAll(async () => {
    try {
      Tezos.setSignerProvider(signerAlice);

      const deployedContract = await migrate(
        Tezos,
        "lottery",
        initialStorage,
        "sandbox"
      );

      aliceLottery = await Lottery.init("alice", deployedContract);
      bobLottery = await Lottery.init("bob", deployedContract);
      carolLottery = await Lottery.init("carol", deployedContract);
    } catch (e) {
      console.log(e);
    }
  });

  describe('Dummy test', () => {
    it('Should not go insane', () => {
      strictEqual(true, true);
    })
  });
});
