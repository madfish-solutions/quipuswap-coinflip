import { ContractMethod, MichelsonMap, Wallet } from '@taquito/taquito';
import assert from 'assert';
import BigNumber from 'bignumber.js';

import { migrate } from '../scripts/helpers';
import { initTezos } from '../utils/helpers';
import { Tezos, signerAlice } from './utils/cli';
import { AssetDescriptor, Coinflip, TEZ_ASSET_DESCRIPTOR } from './coinflip';
import initialStorage from './storage/coinflip';
import { FA2 } from './helpers/FA2';
import { fa2Storage } from './storage/fa2';
import { entrypointErrorTestcase, notAdminTestcase } from './helpers';

interface AccountContractsProxies {
  emptyCoinflip: Coinflip;
  fa2: FA2;
  allAssetsAddedCoinflip: Coinflip;
}

type CoinflipType = Exclude<keyof AccountContractsProxies, 'fa2'>;

const PRECISION = new BigNumber('1e18');
const PERCENT_PRECISION = new BigNumber(1e16);

const defaultPayout = PRECISION.times(1.5);
const defaultNewPayout = PRECISION.times(1.1);
const defaultMaxBetPercentage = PERCENT_PRECISION.times(50);
const defaultNewMaxBetPercentage = PERCENT_PRECISION.times(75);
const defaultNetworkFee = 100;
const nonExistentFA2Descriptor = {
  fA2: {
    address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
    id: new BigNumber(0)
  }
};
const tezAssetId = 0;
const defaultFA2AssetId = 1;
const defaultUnknownAssetId = 2;

describe('Coinflip admin entrypoints test', function () {
  const accountsContractsProxies: Record<string, AccountContractsProxies> = {};
  let testFA2TokenDescriptor: AssetDescriptor;

  async function adminErrorTestcase(
    coinflipType: CoinflipType,
    methodFn: (coinflip: Coinflip) => ContractMethod<Wallet>,
    expectedError: string
  ) {
    const coinflip = accountsContractsProxies.alice[coinflipType];

    await entrypointErrorTestcase(methodFn(coinflip), expectedError);
  }

  beforeAll(async () => {
    try {
      Tezos.setSignerProvider(signerAlice);
      const emptyCoinflipContractAddress: string = await migrate(
        Tezos,
        'coinflip',
        initialStorage,
        'sandbox'
      );
      const aliceEmptyCoinflip = await Coinflip.init(
        'alice',
        emptyCoinflipContractAddress
      );
      const aliceFA2 = await FA2.originate(Tezos, fa2Storage);
      testFA2TokenDescriptor = {
        fA2: { address: aliceFA2.contract.address, id: new BigNumber(0) }
      };
      const fa2TokenBytesKey = aliceEmptyCoinflip.getAssetKey(
        testFA2TokenDescriptor
      );
      const tezBytesKey = aliceEmptyCoinflip.getAssetKey(TEZ_ASSET_DESCRIPTOR);
      const allAssetsAddedCoinflipContractAddress: string = await migrate(
        Tezos,
        'coinflip',
        {
          ...initialStorage,
          assets_counter: new BigNumber(2),
          asset_to_id: MichelsonMap.fromLiteral({
            [tezBytesKey]: new BigNumber(0),
            [fa2TokenBytesKey]: new BigNumber(1)
          }),
          id_to_asset: MichelsonMap.fromLiteral({
            '0': {
              descriptor: TEZ_ASSET_DESCRIPTOR,
              payout_quotient: defaultPayout,
              bank: new BigNumber(0),
              max_bet_percentage: defaultMaxBetPercentage
            },
            '1': {
              descriptor: testFA2TokenDescriptor,
              payout_quotient: defaultPayout,
              bank: new BigNumber(0),
              max_bet_percentage: defaultMaxBetPercentage
            }
          })
        },
        'sandbox'
      );

      await Promise.all(
        ['alice', 'bob', 'carol'].map(async alias => {
          const [emptyCoinflip, fa2, allAssetsAddedCoinflip] = await Promise.all([
            alias === 'alice'
              ? aliceEmptyCoinflip
              : Coinflip.init(alias, emptyCoinflipContractAddress),
            alias === 'alice'
              ? aliceFA2
              : FA2.init(aliceFA2.contract.address, await initTezos(alias)),
            Coinflip.init(alias, allAssetsAddedCoinflipContractAddress)
          ]);
          accountsContractsProxies[alias] = {
            emptyCoinflip,
            fa2,
            allAssetsAddedCoinflip
          };
        })
      );
    } catch (e) {
      console.error(e);
    }
  });

  describe('Testing entrypoint: Set_payout_quotient', () => {
    describe('Testing permissions control', () => {
      it(
        'Should throw error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsAddedCoinflip.setPayoutQuotient(
            tezAssetId,
            defaultNewPayout
          )
        )
      );
  
      it(
        'Should throw error if a non-server and non-admin account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.carol.allAssetsAddedCoinflip.setPayoutQuotient(
            tezAssetId,
            defaultNewPayout
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      // Payout quotients are specified in titles without precision
      it(
        "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient equal to 1",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient less than 1",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION.minus(1)),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should throw 'Coinflip/payout-too-high' error on attempt to set payout quotient greater than 2",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setPayoutQuotient(
            tezAssetId,
            PRECISION.times(2).plus(1)
          ),
          'Coinflip/payout-too-high'
        )
      );

      it(
        "Should throw 'Coinflip/unknown-asset' error on attempt to set payout quotient for unknown asset",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
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
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;

        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setPayoutQuotient(
            tezAssetId,
            newTezPayoutQuotient
          ),
          allAssetsAddedCoinflip.setPayoutQuotient(
            defaultFA2AssetId,
            newFA2TokenPayoutQuotient
          )
        ]);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        await allAssetsAddedCoinflip.updateAssetByDescriptor(
          testFA2TokenDescriptor
        );

        const tezAsset = allAssetsAddedCoinflip.getAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        assert.deepEqual(tezAsset.payout_quotient, newTezPayoutQuotient);
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assert.deepEqual(
          testFA2Asset.payout_quotient,
          newFA2TokenPayoutQuotient
        );
      }
    );

    afterAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setPayoutQuotient(tezAssetId, defaultPayout),
          allAssetsAddedCoinflip.setPayoutQuotient(
            defaultFA2AssetId,
            defaultPayout
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Set_max_bet', () => {
    describe('Testing permissions control', () => {
      it(
        'Should throw error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsAddedCoinflip.setMaxBet(
            tezAssetId,
            defaultNewMaxBetPercentage
          )
        )
      );
  
      it(
        'Should throw error if a non-server and non-admin account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.carol.allAssetsAddedCoinflip.setMaxBet(
            tezAssetId,
            defaultNewMaxBetPercentage
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should throw 'Coinflip/unknown-asset' error on attempt to set max bet for unknown asset",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setMaxBet(
            defaultUnknownAssetId,
            defaultNewMaxBetPercentage
          ),
          'Coinflip/unknown-asset'
        )
      );
  
      it(
        "Should throw 'Coinflip/max-bet-too-low' error on attempt to set max bet equal to zero",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setMaxBet(tezAssetId, 0),
          'Coinflip/max-bet-too-low'
        )
      );
  
      it(
        "Should throw 'Coinflip/max-bet-exceed' error on attempt to set max bet equal to 100%",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setMaxBet(tezAssetId, PRECISION),
          'Coinflip/max-bet-exceed'
        )
      );
  
      it(
        "Should throw 'Coinflip/max-bet-exceed' error on attempt to set max bet greater than 100%",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
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
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;

        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setMaxBet(tezAssetId, newTezMaxBetPercentage),
          allAssetsAddedCoinflip.setMaxBet(
            defaultFA2AssetId,
            newFA2TokenMaxBetPercentage
          )
        ]);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        await allAssetsAddedCoinflip.updateAssetByDescriptor(
          testFA2TokenDescriptor
        );

        const tezAsset = allAssetsAddedCoinflip.getAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        assert.deepEqual(
          tezAsset.max_bet_percentage.toFixed(),
          newTezMaxBetPercentage
        );
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assert.deepEqual(
          testFA2Asset.max_bet_percentage,
          newFA2TokenMaxBetPercentage
        );
      }
    );

    afterAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setMaxBet(tezAssetId, defaultMaxBetPercentage),
          allAssetsAddedCoinflip.setMaxBet(
            defaultFA2AssetId,
            defaultMaxBetPercentage
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Set_network_fee', () => {
    it(
      'Should throw error if server account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.bob.allAssetsAddedCoinflip.setNetworkFee(
          defaultNetworkFee + 1
        )
      )
    );

    it(
      'Should throw error if a non-server and non-admin account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.carol.allAssetsAddedCoinflip.setNetworkFee(
          defaultNetworkFee + 1
        )
      )
    );

    it(
      "Should set network fee",
      async () => {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        
        await allAssetsAddedCoinflip.sendSingle(
          allAssetsAddedCoinflip.setNetworkFee(0)
        );
        await allAssetsAddedCoinflip.updateStorage();

        assert.deepEqual(
          allAssetsAddedCoinflip.storage.network_fee.toNumber(),
          0
        );

        await allAssetsAddedCoinflip.sendSingle(
          allAssetsAddedCoinflip.setNetworkFee(defaultNetworkFee)
        );
        await allAssetsAddedCoinflip.updateStorage();

        assert.deepEqual(
          allAssetsAddedCoinflip.storage.network_fee.toNumber(),
          defaultNetworkFee
        );
      }
    );
  });

  describe('Testing entrypoint: Add_asset', () => {
    describe('Testing permissions control', () => {
      it(
        'Should throw error if server account tries to add asset',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.emptyCoinflip.addAsset(
            PRECISION.plus(1),
            1,
            TEZ_ASSET_DESCRIPTOR
          )
        )
      );
  
      it(
        'Should throw error if a non-server and non-admin account tries to add asset',
        async () => notAdminTestcase(
          accountsContractsProxies.carol.emptyCoinflip.addAsset(
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
          "Should throw 'Coinflip/max-bet-too-low' error for zero max bet",
          async () => adminErrorTestcase(
            'emptyCoinflip',
            coinflip => coinflip.addAsset(
              defaultPayout,
              0,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/max-bet-too-low'
          )
        );
    
        it(
          "Should throw 'Coinflip/max-bet-exceed' error for max bet equal to 100%",
          async () => adminErrorTestcase(
            'emptyCoinflip',
            coinflip => coinflip.addAsset(
              defaultPayout,
              PRECISION,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/max-bet-exceed'
          )
        );
    
        it(
          "Should throw 'Coinflip/max-bet-exceed' error for max bet greater than 100%",
          async () => adminErrorTestcase(
            'emptyCoinflip',
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
          "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient equal to 1",
          async () => adminErrorTestcase(
            'emptyCoinflip',
            coinflip => coinflip.addAsset(
              PRECISION,
              defaultNewMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/payout-too-low'
          )
        );

        it(
          "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient less than 1",
          async () => adminErrorTestcase(
            'allAssetsAddedCoinflip',
            coinflip => coinflip.addAsset(
              PRECISION.minus(1),
              defaultNewMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/payout-too-low'
          )
        );

        it(
          "Should throw 'Coinflip/payout-too-high' error on attempt to set payout quotient greater than 2",
          async () => adminErrorTestcase(
            'allAssetsAddedCoinflip',
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
          "Should throw 'Coinflip/asset-exists' error on attempt to add already added FA2 asset",
          async () => adminErrorTestcase(
            'allAssetsAddedCoinflip',
            coinflip => coinflip.addAsset(
              defaultPayout,
              defaultMaxBetPercentage,
              testFA2TokenDescriptor
            ),
            'Coinflip/asset-exists'
          )
        );

        it(
          "Should throw 'Coinflip/asset-exists' error on attempt to add already added TEZ asset",
          async () => adminErrorTestcase(
            'allAssetsAddedCoinflip',
            coinflip => coinflip.addAsset(
              defaultPayout,
              defaultMaxBetPercentage,
              TEZ_ASSET_DESCRIPTOR
            ),
            'Coinflip/asset-exists'
          )
        );

        it(
          "Should throw 'Coinflip/invalid-asset' error on attempt to add non-existent asset",
          async () => adminErrorTestcase(
            'allAssetsAddedCoinflip',
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
        const { emptyCoinflip } = accountsContractsProxies.alice;
        const prevAssetsCounter = emptyCoinflip.storage.assets_counter;

        await emptyCoinflip.sendSingle(
          emptyCoinflip.addAsset(PRECISION.plus(1), 1, TEZ_ASSET_DESCRIPTOR)
        );
        await emptyCoinflip.updateAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);

        const addedAsset = emptyCoinflip.getAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        assert.deepEqual(
          emptyCoinflip.storage.assets_counter,
          prevAssetsCounter.plus(1)
        );
        assert(addedAsset && ('tez' in addedAsset.descriptor));
      }
    );

    it(
      "Should add FA2 asset if it hasn't been added yet",
      async () => {
        const { emptyCoinflip } = accountsContractsProxies.alice;
        const prevAssetsCounter = emptyCoinflip.storage.assets_counter;

        await emptyCoinflip.sendSingle(
          emptyCoinflip.addAsset(
            defaultPayout,
            defaultMaxBetPercentage,
            testFA2TokenDescriptor
          )
        );
        await emptyCoinflip.updateAssetByDescriptor(testFA2TokenDescriptor);

        const addedAsset = emptyCoinflip.getAssetByDescriptor(
          testFA2TokenDescriptor
        );
        assert.deepEqual(
          emptyCoinflip.storage.assets_counter,
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
