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
const defaultPayout = precision.times(3).idiv(2);
const defaultMaxBetPercentage = percentPrecision.times(50);

describe('Coinflip admin entrypoints test', function () {
  const accountsContractsProxies: Record<string, AccountContractsProxies> = {};
  let defaultFA2TokenDescriptor: AssetDescriptor;

  beforeAll(async () => {
    try {
      Tezos.setSignerProvider(signerAlice);
      const emptyCoinflipContractAddress: string = await migrate(Tezos, 'coinflip', initialStorage, 'sandbox');
      const aliceEmptyCoinflip = await Coinflip.init('alice', emptyCoinflipContractAddress);
      const aliceFA2 = await FA2.originate(Tezos, fa2Storage);
      defaultFA2TokenDescriptor = { fA2: { address: aliceFA2.contract.address, id: new BigNumber(0) } };
      const fa2TokenBytesKey = aliceEmptyCoinflip.getAssetKey(defaultFA2TokenDescriptor);
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
              descriptor: defaultFA2TokenDescriptor,
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
            alias === 'alice' ? aliceEmptyCoinflip : Coinflip.init(alias, emptyCoinflipContractAddress),
            alias === 'alice' ? aliceFA2 : FA2.init(aliceFA2.contract.address, await initTezos(alias)),
            Coinflip.init(alias, allAssetsAddedCoinflipContractAddress)
          ]);
          accountsContractsProxies[alias] = { emptyCoinflip, fa2, allAssetsAddedCoinflip };
        })
      );
    } catch (e) {
      console.error(e);
    }
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
        assert.strictEqual(
          emptyCoinflip.storage.assets_counter.toFixed(),
          prevAssetsCounter.plus(1).toFixed()
        );
        assert(addedAsset && ('tez' in addedAsset.descriptor));
      }
    );

    it(
      "Should throw 'Coinflip/asset-exists' error on attempt to add already added TEZ asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.addAsset(TEZ_ASSET_DESCRIPTOR),
        'Coinflip/asset-exists'
      )
    );

    it(
      "Should add FA2 asset if it hasn't been added yet",
      async () => {
        const { emptyCoinflip } = accountsContractsProxies.alice;
        const prevAssetsCounter = emptyCoinflip.storage.assets_counter;

        await emptyCoinflip.sendSingle(emptyCoinflip.addAsset(defaultFA2TokenDescriptor));
        await emptyCoinflip.updateAssetByDescriptor(defaultFA2TokenDescriptor);

        const addedAsset = emptyCoinflip.getAssetByDescriptor(defaultFA2TokenDescriptor);
        assert.strictEqual(
          emptyCoinflip.storage.assets_counter.toFixed(),
          prevAssetsCounter.plus(1).toFixed()
        );
        assert.deepEqual(
          addedAsset,
          {
            bank: new BigNumber(0),
            descriptor: defaultFA2TokenDescriptor,
            max_bet_percentage: defaultMaxBetPercentage,
            payout_quotient: defaultPayout
          }
        );
      }
    );

    it(
      "Should throw 'Coinflip/asset-exists' error on attempt to add already added FA2 asset",
      async () => entrypointErrorTestcase(
        accountsContractsProxies.alice.allAssetsAddedCoinflip.addAsset(defaultFA2TokenDescriptor),
        'Coinflip/asset-exists'
      )
    );
  });
});
