import { makeEmptyCoinflip } from '../account-contracts-proxies';
import { Coinflip } from '../coinflip';
import { defaultNetworkFee } from '../constants';
import { assertNumberValuesEquality, notAdminTestcase } from '../helpers';

describe('Coinflip admin other entrypoints test', function () {
  let coinflips: Record<string, Coinflip> = {};

  beforeAll(async () => {
    coinflips = await makeEmptyCoinflip();
  });

  describe('Testing entrypoint: Set_network_fee', () => {
    it(
      'Should fail with error if server account tries to call the entrypoint',
      async () => notAdminTestcase(
        coinflips.bob.setNetworkFee(defaultNetworkFee)
      )
    );

    it(
      'Should fail with error if a non-server and non-admin account tries \
to call the entrypoint',
      async () => notAdminTestcase(
        coinflips.carol.setNetworkFee(defaultNetworkFee)
      )
    );

    it(
      "Should set network fee",
      async () => {
        const coinflip = coinflips.alice;
        
        await coinflip.sendSingle(coinflip.setNetworkFee(0));
        await coinflip.updateStorage();

        assertNumberValuesEquality(coinflip.storage.network_fee, 0);

        await coinflip.sendSingle(coinflip.setNetworkFee(defaultNetworkFee));
        await coinflip.updateStorage();

        assertNumberValuesEquality(
          coinflip.storage.network_fee,
          defaultNetworkFee
        );
      }
    );
  });
});
