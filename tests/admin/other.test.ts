import { alice, bob, carol } from '../../scripts/sandbox/accounts';
import { makeEmptyCoinflip } from '../account-contracts-proxies';
import { Coinflip } from '../coinflip';
import { defaultNetworkFee } from '../constants';
import { expectNumberValuesEquality, notAdminTestcase } from '../helpers';

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

        expectNumberValuesEquality(coinflip.storage.network_fee, 0);

        await coinflip.sendSingle(coinflip.setNetworkFee(defaultNetworkFee));
        await coinflip.updateStorage();

        expectNumberValuesEquality(
          coinflip.storage.network_fee,
          defaultNetworkFee
        );
      }
    );
  });

  describe('Testing entrypoint: Set_admin', () => {
    it(
      'Should fail with error if server account tries to call the entrypoint',
      async () => notAdminTestcase(coinflips.bob.setAdmin(bob.pkh))
    );

    it(
      'Should fail with error if a non-server and non-admin account tries \
to call the entrypoint',
      async () => notAdminTestcase(coinflips.carol.setAdmin(carol.pkh))
    );

    it(
      "Should set new admin",
      async () => {
        const { alice: aliceCoinflip, bob: bobCoinflip } = coinflips;

        await aliceCoinflip.sendSingle(aliceCoinflip.setAdmin(bob.pkh));
        await aliceCoinflip.updateStorage();

        expect(aliceCoinflip.storage.admin).toStrictEqual(bob.pkh);

        await bobCoinflip.sendSingle(bobCoinflip.setAdmin(alice.pkh));
      }
    );
  });

  describe('Testing entrypoint: Set_server', () => {
    it(
      'Should fail with error if server account tries to call the entrypoint',
      async () => notAdminTestcase(coinflips.bob.setServer(alice.pkh))
    );

    it(
      'Should fail with error if a non-server and non-admin account tries \
to call the entrypoint',
      async () => notAdminTestcase(coinflips.carol.setServer(alice.pkh))
    );

    it(
      "Should set new server",
      async () => {
        const { alice: aliceCoinflip } = coinflips;
        
        await aliceCoinflip.sendSingle(aliceCoinflip.setServer(carol.pkh));
        await aliceCoinflip.updateStorage();

        expect(aliceCoinflip.storage.server).toEqual(carol.pkh);

        await aliceCoinflip.sendSingle(aliceCoinflip.setServer(bob.pkh));
      }
    );
  });
});
