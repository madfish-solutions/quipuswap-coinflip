import BigNumber from 'bignumber.js';

import { Asset, Coinflip, TEZ_ASSET } from '../coinflip';
import {
  adminErrorTestcase,
  expectNumberValuesEquality,
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
  nonExistentFA2Asset,
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
  let testFA2TokenAsset: Asset;
  let allAssetsAddedCoinflips: Record<string, Coinflip> = {};
  let emptyCoinflips: Record<string, Coinflip> = {};

  beforeAll(async () => {
    console.log('assets-operations: beforeAll');
    try {
      const fa2Wrappers = await makeFA2();
      const fa2TokenAddress = fa2Wrappers.alice.contract.address;
      testFA2TokenAsset = {
        fa2: {
          address: fa2TokenAddress,
          id: new BigNumber(defaultFA2TokenId)
        }
      };
      emptyCoinflips = await makeEmptyCoinflip();
      allAssetsAddedCoinflips = await makeAllAssetsAddedCoinflip(
        fa2TokenAddress,
        defaultFA2TokenId
      );
    } catch (e) {
      console.error(e);
    }
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
        await coinflip.updateAssetRecord(TEZ_ASSET);
        await coinflip.updateAssetRecord(testFA2TokenAsset);

        const tezAsset = coinflip.getAssetRecord(TEZ_ASSET);
        expectNumberValuesEquality(
          tezAsset.payout_quot_f,
          newTezPayoutQuotient
        );
        const testFA2Asset = coinflip.getAssetRecord(
          testFA2TokenAsset
        );
        expectNumberValuesEquality(
          testFA2Asset.payout_quot_f,
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
        await coinflip.updateAssetRecord(
          TEZ_ASSET
        );
        await coinflip.updateAssetRecord(
          testFA2TokenAsset
        );

        const tezAsset = coinflip.getAssetRecord(
          TEZ_ASSET
        );
        expectNumberValuesEquality(
          tezAsset.max_bet_percent_f,
          newTezMaxBetPercentage
        );
        const testFA2Asset = coinflip.getAssetRecord(
          testFA2TokenAsset
        );
        expectNumberValuesEquality(
          testFA2Asset.max_bet_percent_f,
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
            TEZ_ASSET
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to add asset',
        async () => notAdminTestcase(
          emptyCoinflips.carol.addAsset(
            PRECISION.plus(1),
            1,
            TEZ_ASSET
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
              TEZ_ASSET
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
              TEZ_ASSET
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
              TEZ_ASSET
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
              TEZ_ASSET
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
              TEZ_ASSET
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
              TEZ_ASSET
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
              testFA2TokenAsset
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
              TEZ_ASSET
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
              nonExistentFA2Asset
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
          coinflip.addAsset(PRECISION.plus(1), 1, TEZ_ASSET)
        );
        await coinflip.updateAssetRecord(TEZ_ASSET);

        const addedAsset = coinflip.getAssetRecord(TEZ_ASSET);
        expectNumberValuesEquality(
          coinflip.storage.assets_counter,
          prevAssetsCounter.plus(1)
        );
        expect(addedAsset).toBeTruthy();
        expect('tez' in addedAsset.asset).toBeTruthy();
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
            testFA2TokenAsset
          )
        );
        await coinflip.updateAssetRecord(testFA2TokenAsset);

        const addedAsset = coinflip.getAssetRecord(
          testFA2TokenAsset
        );
        expectNumberValuesEquality(
          coinflip.storage.assets_counter,
          prevAssetsCounter.plus(1)
        );
        expect(addedAsset).toEqual({
          bank: new BigNumber(0),
          asset: testFA2TokenAsset,
          max_bet_percent_f: defaultMaxBetPercentage,
          payout_quot_f: defaultPayout,
          paused: false
        });
      }
    );
  });

  describe('Testing entrypoint: Set_paused', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(emptyCoinflips.bob.setPaused(1, true))
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
        async () => notAdminTestcase(emptyCoinflips.carol.setPaused(1, true))
      );
    });

    it(
      "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
      async () => adminErrorTestcase(
        allAssetsAddedCoinflips,
        coinflip => coinflip.setPaused(defaultUnknownAssetId, true),
        'Coinflip/unknown-asset'
      )
    );

    it(
      "Should do nothing if previous 'paused' value is equal to new one",
      async () => {
        const coinflip = allAssetsAddedCoinflips.alice;
        await coinflip.sendBatch([
          coinflip.setPaused(tezAssetId, false),
          coinflip.setPaused(defaultFA2AssetId, true)
        ]);
        await coinflip.updateStorage({ id_to_asset: [tezAssetId, defaultFA2AssetId] });
        const { id_to_asset } = coinflip.storage;
        expect(id_to_asset.get(tezAssetId)?.paused).toEqual(false);
        expect(id_to_asset.get(defaultFA2AssetId)?.paused).toEqual(true);
      }
    );

    it(
      "Should change 'paused' value if previous value is not equal to new one",
      async () => {
        const coinflip = allAssetsAddedCoinflips.alice;
        await coinflip.sendBatch([
          coinflip.setPaused(tezAssetId, true),
          coinflip.setPaused(defaultFA2AssetId, false)
        ]);
        await coinflip.updateStorage({ id_to_asset: [tezAssetId, defaultFA2AssetId] });
        const { id_to_asset } = coinflip.storage;
        expect(id_to_asset.get(tezAssetId).paused).toEqual(true);
        expect(id_to_asset.get(defaultFA2AssetId).paused).toEqual(false);
      }
    );
  });

  afterAll(() => {
    console.log('assets-operations: afterAll');
  });
});
