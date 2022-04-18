import assert from 'assert';
import BigNumber from 'bignumber.js';

import { Tezos } from '../utils/cli';
import { AssetDescriptor, Coinflip, TEZ_ASSET_DESCRIPTOR } from '../coinflip';
import defaultStorage from '../storage/coinflip';
import {
  adminErrorTestcase,
  assertNumberValuesEquality,
  BatchContentsEntry,
  entrypointErrorTestcase,
  notAdminTestcase
} from '../helpers';
import {
  defaultPayout,
  defaultMaxBetPercentage,
  PRECISION,
  PERCENT_PRECISION,
  tezAssetId,
  defaultUnknownAssetId,
  defaultFA2AssetId,
  nonExistentFA2Descriptor,
  defaultFA2TokenId
} from '../constants';
import {
  makeAllAssetsAddedCoinflip,
  makeEmptyCoinflip,
  makeFA2
} from '../account-contracts-proxies';

const defaultNewMaxBetPercentage = PERCENT_PRECISION.times(75);
const defaultNewPayout = PRECISION.times(1.1);

describe('Coinflip admin assets entrypoints test', function () {
  let testFA2TokenDescriptor: AssetDescriptor;
  let allAssetsAddedCoinflips: Record<string, Coinflip> = {};
  let emptyCoinflips: Record<string, Coinflip> = {};

  beforeAll(async () => {
    const fa2Wrappers = await makeFA2();
    const fa2TokenAddress = fa2Wrappers.alice.contract.address;
    testFA2TokenDescriptor = {
      fA2: {
        address: fa2TokenAddress,
        id: new BigNumber(defaultFA2TokenId)
      }
    };
    emptyCoinflips = await makeEmptyCoinflip();
    allAssetsAddedCoinflips = await makeAllAssetsAddedCoinflip(fa2TokenAddress, defaultFA2TokenId);
  });

  describe('Testing entrypoint: Set_payout_quotient', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          allAssetsAddedCoinflips.bob.setPayoutQuotient(
            tezAssetId,
            defaultNewPayout
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
        async () => notAdminTestcase(
          allAssetsAddedCoinflips.carol.setPayoutQuotient(
            tezAssetId,
            defaultNewPayout
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      // Payout quotients are specified in titles without precision
      it(
        "Should fail with 'Coinflip/payout-too-low' error for payout quotient \
equal to 1",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should fail with 'Coinflip/payout-too-low' error for payout quotient \
less than 1",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION.minus(1)),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should fail with 'Coinflip/payout-too-high' error for payout quotient \
greater than 2",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setPayoutQuotient(
            tezAssetId,
            PRECISION.times(2).plus(1)
          ),
          'Coinflip/payout-too-high'
        )
      );

      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setPayoutQuotient(
            defaultUnknownAssetId,
            defaultNewPayout
          ),
          'Coinflip/unknown-asset'
        )
      );
    });

    it(
      'Should set valid payout quotient for the specified asset',
      async () => {
        const newTezPayoutQuotient = PRECISION.plus(1);
        const newFA2TokenPayoutQuotient = PRECISION.times(2);
        const coinflip = allAssetsAddedCoinflips.alice;

        await coinflip.sendBatch([
          coinflip.setPayoutQuotient(tezAssetId, newTezPayoutQuotient),
          coinflip.setPayoutQuotient(
            defaultFA2AssetId,
            newFA2TokenPayoutQuotient
          )
        ]);
        await coinflip.updateAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        await coinflip.updateAssetByDescriptor(testFA2TokenDescriptor);

        const tezAsset = coinflip.getAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        assertNumberValuesEquality(
          tezAsset.payout_quotient,
          newTezPayoutQuotient
        );
        const testFA2Asset = coinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assertNumberValuesEquality(
          testFA2Asset.payout_quotient,
          newFA2TokenPayoutQuotient
        );
      }
    );

    afterAll(async () => {
      try {
        const coinflip = allAssetsAddedCoinflips.alice;
        await coinflip.sendBatch([
          coinflip.setPayoutQuotient(tezAssetId, defaultPayout),
          coinflip.setPayoutQuotient(defaultFA2AssetId, defaultPayout)
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Set_max_bet', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          allAssetsAddedCoinflips.bob.setMaxBet(
            tezAssetId,
            defaultNewMaxBetPercentage
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
        async () => notAdminTestcase(
          allAssetsAddedCoinflips.carol.setMaxBet(
            tezAssetId,
            defaultNewMaxBetPercentage
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setMaxBet(
            defaultUnknownAssetId,
            defaultNewMaxBetPercentage
          ),
          'Coinflip/unknown-asset'
        )
      );
  
      it(
        "Should fail with 'Coinflip/max-bet-too-low' error for max bet \
equal to zero",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setMaxBet(tezAssetId, 0),
          'Coinflip/max-bet-too-low'
        )
      );
  
      it(
        "Should fail with 'Coinflip/max-bet-exceed' error for max bet equal to 100%",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setMaxBet(tezAssetId, PRECISION),
          'Coinflip/max-bet-exceed'
        )
      );
  
      it(
        "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
greater than 100%",
        async () => adminErrorTestcase(
          allAssetsAddedCoinflips,
          coinflip => coinflip.setMaxBet(tezAssetId, PRECISION.plus(1)),
          'Coinflip/max-bet-exceed'
        )
      );
    });

    it(
      "Should set correct max bet for the specified asset",
      async () => {
        const newFA2TokenMaxBetPercentage = PRECISION.minus(1);
        const newTezMaxBetPercentage = '1';
        const coinflip = allAssetsAddedCoinflips.alice;

        await coinflip.sendBatch([
          coinflip.setMaxBet(tezAssetId, newTezMaxBetPercentage),
          coinflip.setMaxBet(
            defaultFA2AssetId,
            newFA2TokenMaxBetPercentage
          )
        ]);
        await coinflip.updateAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        await coinflip.updateAssetByDescriptor(
          testFA2TokenDescriptor
        );

        const tezAsset = coinflip.getAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        assertNumberValuesEquality(
          tezAsset.max_bet_percentage,
          newTezMaxBetPercentage
        );
        const testFA2Asset = coinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assertNumberValuesEquality(
          testFA2Asset.max_bet_percentage,
          newFA2TokenMaxBetPercentage
        );
      }
    );

    afterAll(async () => {
      try {
        const coinflip = allAssetsAddedCoinflips.alice;
        await coinflip.sendBatch([
          coinflip.setMaxBet(tezAssetId, defaultMaxBetPercentage),
          coinflip.setMaxBet(
            defaultFA2AssetId,
            defaultMaxBetPercentage
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Add_asset', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to add asset',
        async () => notAdminTestcase(
          emptyCoinflips.bob.addAsset(
            PRECISION.plus(1),
            1,
            TEZ_ASSET_DESCRIPTOR
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to add asset',
        async () => notAdminTestcase(
          emptyCoinflips.bob.addAsset(
            PRECISION.plus(1),
            1,
            TEZ_ASSET_DESCRIPTOR
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      describe('Testing max bet validation', () => {
        it(
          "Should fail with 'Coinflip/max-bet-too-low' error for zero max bet",
          async () => adminErrorTestcase(
            emptyCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              0,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/max-bet-too-low'
          )
        );
    
        it(
          "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
equal to 100%",
          async () => adminErrorTestcase(
            emptyCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              PRECISION,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/max-bet-exceed'
          )
        );
    
        it(
          "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
greater than 100%",
          async () => adminErrorTestcase(
            emptyCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              PRECISION.plus(1),
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/max-bet-exceed'
          )
        );
      });

      describe('Testing payout quotient validation', () => {
        // Payout quotients are specified in titles without precision
        it(
          "Should fail with 'Coinflip/payout-too-low' error for \
payout quotient equal to 1",
          async () => adminErrorTestcase(
            emptyCoinflips,
            coinflip => coinflip.addAsset(
              PRECISION,
              defaultNewMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/payout-too-low'
          )
        );

        it(
          "Should fail with 'Coinflip/payout-too-low' error for \
payout quotient less than 1",
          async () => adminErrorTestcase(
            allAssetsAddedCoinflips,
            coinflip => coinflip.addAsset(
              PRECISION.minus(1),
              defaultNewMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/payout-too-low'
          )
        );

        it(
          "Should fail with 'Coinflip/payout-too-high' error for \
payout quotient greater than 2",
          async () => adminErrorTestcase(
            allAssetsAddedCoinflips,
            coinflip => coinflip.addAsset(
              PRECISION.times(2).plus(1),
              defaultNewMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/payout-too-high'
          )
        );
      });

      describe('Testing asset validation', () => {
        it(
          "Should fail with 'Coinflip/asset-exists' error for already added \
FA2 asset",
          async () => adminErrorTestcase(
            allAssetsAddedCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              defaultMaxBetPercentage,
              testFA2TokenDescriptor
            ),
            'Coinflip/asset-exists'
          )
        );

        it(
          "Should fail with 'Coinflip/asset-exists' error for already added \
TEZ asset",
          async () => adminErrorTestcase(
            allAssetsAddedCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              defaultMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/asset-exists'
          )
        );

        it(
          "Should fail with 'Coinflip/invalid-asset' error for non-existent asset",
          async () => adminErrorTestcase(
            allAssetsAddedCoinflips,
            coinflip => coinflip.addAsset(
              defaultPayout,
              defaultMaxBetPercentage,
              nonExistentFA2Descriptor
            ),
            'Coinflip/invalid-asset'
          )
        );
      });
    });

    it(
      "Should add tez asset if it hasn't been added yet",
      async () => {
        const coinflip = emptyCoinflips.alice;
        const prevAssetsCounter = coinflip.storage.assets_counter;

        await coinflip.sendSingle(
          coinflip.addAsset(PRECISION.plus(1), 1, TEZ_ASSET_DESCRIPTOR)
        );
        await coinflip.updateAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);

        const addedAsset = coinflip.getAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        assertNumberValuesEquality(
          coinflip.storage.assets_counter,
          prevAssetsCounter.plus(1)
        );
        assert(addedAsset && ('tez' in addedAsset.descriptor));
      }
    );

    it(
      "Should add FA2 asset if it hasn't been added yet",
      async () => {
        const coinflip = emptyCoinflips.alice;
        const prevAssetsCounter = coinflip.storage.assets_counter;

        await coinflip.sendSingle(
          coinflip.addAsset(
            defaultPayout,
            defaultMaxBetPercentage,
            testFA2TokenDescriptor
          )
        );
        await coinflip.updateAssetByDescriptor(testFA2TokenDescriptor);

        const addedAsset = coinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assertNumberValuesEquality(
          coinflip.storage.assets_counter,
          prevAssetsCounter.plus(1)
        );
        assert.deepEqual(
          addedAsset,
          {
            bank: new BigNumber(0),
            descriptor: testFA2TokenDescriptor,
            max_bet_percentage: defaultMaxBetPercentage,
            payout_quotient: defaultPayout
          }
        );
      }
    );
  });
});