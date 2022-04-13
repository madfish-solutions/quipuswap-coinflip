import { MichelsonMap } from '@taquito/taquito';
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

const precision = new BigNumber('1e18');
const percentPrecision = new BigNumber(1e16);
const defaultPayout = precision.times(1.5);
const defaultNewPayout = precision.times(1.1);
const defaultMaxBetPercentage = percentPrecision.times(50);
const defaultNewMaxBetPercentage = percentPrecision.times(200);

describe('Coinflip admin entrypoints test', function () {
  const accountsContractsProxies: Record<string, AccountContractsProxies> = {};
  let testFA2TokenDescriptor: AssetDescriptor;

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
      const fa2TokenBytesKey = aliceEmptyCoinflip.getAssetKey(testFA2TokenDescriptor);
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
    beforeAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setPayoutQuotient(
            TEZ_ASSET_DESCRIPTOR,
            defaultPayout
          ),
          allAssetsAddedCoinflip.setPayoutQuotient(
            testFA2TokenDescriptor,
            defaultPayout
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });

    it(
      'Should throw error if server account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.bob.allAssetsAddedCoinflip.setPayoutQuotient(
          TEZ_ASSET_DESCRIPTOR,
          defaultNewPayout
        )
      )
    );

    it(
      'Should throw error if a non-server and non-admin account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.carol.allAssetsAddedCoinflip.setPayoutQuotient(
          TEZ_ASSET_DESCRIPTOR,
          defaultNewPayout
        )
      )
    );

    it(
      "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient equal to 1e18",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.setPayoutQuotient(
          TEZ_ASSET_DESCRIPTOR,
          precision
        ),
        'Coinflip/payout-too-low'
      )
    );

    it(
      "Should throw 'Coinflip/payout-too-low' error on attempt to set payout quotient less than 1e18",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.setPayoutQuotient(
          TEZ_ASSET_DESCRIPTOR,
          precision.minus(1)
        ),
        'Coinflip/payout-too-low'
      )
    );

    it(
      "Should throw 'Coinflip/unknown-asset' error on attempt to set payout quotient for unknown asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.setPayoutQuotient(
          {
            fA2: {
              address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
              id: new BigNumber(0)
            }
          },
          defaultNewPayout
        ),
        'Coinflip/unknown-asset'
      )
    );

    it(
      'Should set payout quotient for the specified asset',
      async () => {
        const testFA2TokenPayoutQuotient = precision.times(1.25);
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;

        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setPayoutQuotient(TEZ_ASSET_DESCRIPTOR, defaultNewPayout),
          allAssetsAddedCoinflip.setPayoutQuotient(testFA2TokenDescriptor, testFA2TokenPayoutQuotient)
        ]);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(testFA2TokenDescriptor);

        const tezAsset = allAssetsAddedCoinflip.getAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        assert.deepEqual(tezAsset.payout_quotient, defaultNewPayout);
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(testFA2TokenDescriptor);
        assert.deepEqual(testFA2Asset.payout_quotient, testFA2TokenPayoutQuotient);
      }
    );

    afterAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setPayoutQuotient(
            TEZ_ASSET_DESCRIPTOR,
            defaultPayout
          ),
          allAssetsAddedCoinflip.setPayoutQuotient(
            testFA2TokenDescriptor,
            defaultPayout
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Set_max_bet', () => {
    beforeAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setMaxBet(
            TEZ_ASSET_DESCRIPTOR,
            defaultMaxBetPercentage
          ),
          allAssetsAddedCoinflip.setMaxBet(
            testFA2TokenDescriptor,
            defaultMaxBetPercentage
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });

    it(
      'Should throw error if server account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.bob.allAssetsAddedCoinflip.setMaxBet(
          TEZ_ASSET_DESCRIPTOR,
          defaultNewMaxBetPercentage
        )
      )
    );

    it(
      'Should throw error if a non-server and non-admin account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.carol.allAssetsAddedCoinflip.setMaxBet(
          TEZ_ASSET_DESCRIPTOR,
          defaultNewMaxBetPercentage
        )
      )
    );

    it(
      "Should throw 'Coinflip/unknown-asset' error on attempt to set max bet for unknown asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.setMaxBet(
          {
            fA2: {
              address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
              id: new BigNumber(0)
            }
          },
          defaultNewMaxBetPercentage
        ),
        'Coinflip/unknown-asset'
      )
    );

    it(
      "Should throw 'Coinflip/max-bet-exceed' error on attempt to set max bet that \
causes reward payment fail in case of victory",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.setMaxBet(
          TEZ_ASSET_DESCRIPTOR,
          defaultNewMaxBetPercentage.plus(1)
        ),
        'Coinflip/max-bet-exceed'
      )
    );

    it(
      "Should set correct max bet for the specified asset",
      async () => {
        const testFA2TokenMaxBetPercentage = defaultNewMaxBetPercentage.minus(1);
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;

        const op = await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setMaxBet(TEZ_ASSET_DESCRIPTOR, defaultNewMaxBetPercentage),
          allAssetsAddedCoinflip.setMaxBet(testFA2TokenDescriptor, testFA2TokenMaxBetPercentage)
        ]);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        await allAssetsAddedCoinflip.updateAssetByDescriptor(testFA2TokenDescriptor);

        const tezAsset = allAssetsAddedCoinflip.getAssetByDescriptor(TEZ_ASSET_DESCRIPTOR);
        assert.deepEqual(tezAsset.max_bet_percentage, defaultNewMaxBetPercentage);
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(testFA2TokenDescriptor);
        assert.deepEqual(testFA2Asset.max_bet_percentage, testFA2TokenMaxBetPercentage);
      }
    );

    afterAll(async () => {
      try {
        const { allAssetsAddedCoinflip } = accountsContractsProxies.alice;
        await allAssetsAddedCoinflip.sendBatch([
          allAssetsAddedCoinflip.setMaxBet(
            TEZ_ASSET_DESCRIPTOR,
            defaultMaxBetPercentage
          ),
          allAssetsAddedCoinflip.setMaxBet(
            testFA2TokenDescriptor,
            defaultMaxBetPercentage
          )
        ]);
      } catch (e) {
        console.error(e);
      }
    });
  });

  describe('Testing entrypoint: Add_asset', () => {
    it(
      'Should throw error if server account tries to add asset',
      async () => notAdminTestcase(
        accountsContractsProxies.bob.emptyCoinflip.addAsset(TEZ_ASSET_DESCRIPTOR)
      )
    );

    it(
      'Should throw error if a non-server and non-admin account tries to add asset',
      async () => notAdminTestcase(
        accountsContractsProxies.carol.emptyCoinflip.addAsset(TEZ_ASSET_DESCRIPTOR)
      )
    );

    it(
      "Should add tez asset if it hasn't been added yet",
      async () => {
        const { emptyCoinflip } = accountsContractsProxies.alice;
        const prevAssetsCounter = emptyCoinflip.storage.assets_counter;

        await emptyCoinflip.sendSingle(emptyCoinflip.addAsset(TEZ_ASSET_DESCRIPTOR));
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
      "Should throw 'Coinflip/asset-exists' error on attempt to add already added TEZ asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.addAsset(
          TEZ_ASSET_DESCRIPTOR
        ),
        'Coinflip/asset-exists'
      )
    );

    it(
      "Should add FA2 asset if it hasn't been added yet",
      async () => {
        const { emptyCoinflip } = accountsContractsProxies.alice;
        const prevAssetsCounter = emptyCoinflip.storage.assets_counter;

        await emptyCoinflip.sendSingle(
          emptyCoinflip.addAsset(testFA2TokenDescriptor)
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

    it(
      "Should throw 'Coinflip/asset-exists' error on attempt to add already added FA2 asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.addAsset(
          testFA2TokenDescriptor
        ),
        'Coinflip/asset-exists'
      )
    );

    it(
      "Should throw 'Coinflip/invalid-asset' error on attempt to add unknown asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.addAsset({
          fA2: {
            address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
            id: new BigNumber(0)
          }
        }),
        'Coinflip/invalid-asset'
      )
    );
  });
});
