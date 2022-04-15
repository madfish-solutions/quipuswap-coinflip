import { TransactionOperation } from '@taquito/taquito';
import assert from 'assert';
import BigNumber from 'bignumber.js';

import { initTezos } from '../utils/helpers';
import { Tezos, signerAlice } from './utils/cli';
import {
  AssetDescriptor,
  Coinflip,
  CoinflipStorage,
  TEZ_ASSET_DESCRIPTOR
} from './coinflip';
import defaultStorage from './storage/coinflip';
import { FA2 } from './helpers/FA2';
import { fa2Storage } from './storage/fa2';
import {
  assertNumberValuesEquality,
  BatchContentsEntry,
  BatchWalletOperation,
  entrypointErrorTestcase,
  getTotalFee,
  makeStorage,
  notAdminTestcase
} from './helpers';
import { alice } from '../scripts/sandbox/accounts';

interface AccountContractsProxies {
  emptyCoinflip: Coinflip;
  fa2: FA2;
  allAssetsAddedCoinflip: Coinflip;
  allAssetsWithBankCoinflip: Coinflip;
}

type CoinflipType = Exclude<keyof AccountContractsProxies, 'fa2'>;

// Some contract constants
const PRECISION = new BigNumber('1e18');
const PERCENT_PRECISION = new BigNumber(1e16);

// Tests configuration values
const defaultPayout = PRECISION.times(1.5);
const defaultNewPayout = PRECISION.times(1.1);
const defaultMaxBetPercentage = PERCENT_PRECISION.times(50);
const defaultNewMaxBetPercentage = PERCENT_PRECISION.times(75);
const defaultNetworkFee = defaultStorage.network_fee;
const defaultAddBankAmount = 700;
const withdrawalTestNetworkBank = 2000;
const withdrawalTestTezBank = 5000;
const withdrawalTestFa2TokenBank = 1000;

const nonExistentFA2Descriptor = {
  fA2: {
    address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
    id: new BigNumber(0)
  }
};
const defaultFA2TokenId = 0;
const tezAssetId = '0';
const defaultFA2AssetId = '1';
const defaultUnknownAssetId = '2';

const makeAssetEntry = (
  assetDescriptor: AssetDescriptor,
  bank: BigNumber.Value = new BigNumber(0)
) => ({
  descriptor: assetDescriptor,
  payout_quotient: defaultPayout,
  bank: new BigNumber(bank),
  max_bet_percentage: defaultMaxBetPercentage
});

describe('Coinflip admin entrypoints test', function () {
  const accountsContractsProxies: Record<string, AccountContractsProxies> = {};
  let testFA2TokenDescriptor: AssetDescriptor;

  async function adminErrorTestcase(
    coinflipType: CoinflipType,
    methodFn: (coinflip: Coinflip) => BatchContentsEntry,
    expectedError: string
  ) {
    const coinflip = accountsContractsProxies.alice[coinflipType];

    await entrypointErrorTestcase(methodFn(coinflip), expectedError);
  }

  async function aliceTestcaseWithBalancesDiff(
    coinflipType: CoinflipType,
    balancesDiffs: {
      noFeesAliceTez: BigNumber.Value,
      aliceFA2: BigNumber.Value,
      contractTez: BigNumber.Value,
      contractFA2: BigNumber.Value,
    },
    operation: (coinflip: Coinflip, fa2: FA2) => Promise<
      BatchWalletOperation | TransactionOperation
    >,
    otherAssertions: (
      prevStorage: CoinflipStorage,
      currentStorage: CoinflipStorage
    ) => void | Promise<void>
  ) {
    const { [coinflipType]: coinflip, fa2 } = accountsContractsProxies.alice;
    const { contractAddress, storage: prevStorage } = coinflip;
    await fa2.updateStorage({ account_info: [alice.pkh, contractAddress] });
    const oldBalances = {
      aliceTez: await Tezos.tz.getBalance(alice.pkh),
      aliceFA2: fa2.getTokenBalance(alice.pkh, String(defaultFA2TokenId)),
      contractTez: await Tezos.tz.getBalance(contractAddress),
      contractFA2: fa2.getTokenBalance(contractAddress, String(defaultFA2TokenId))
    };
    const totalFee = await getTotalFee(await operation(coinflip, fa2));
    console.log((await Tezos.rpc.getBlockHeader()).level);
    await coinflip.updateStorage({
      id_to_asset: [tezAssetId, defaultFA2AssetId]
    });
    await fa2.updateStorage({ account_info: [alice.pkh, contractAddress] });
    const newBalances = {
      aliceTez: await Tezos.tz.getBalance(alice.pkh),
      aliceFA2: fa2.getTokenBalance(alice.pkh, String(defaultFA2TokenId)),
      contractTez: await Tezos.tz.getBalance(contractAddress),
      contractFA2: fa2.getTokenBalance(contractAddress, String(defaultFA2TokenId))
    };
    assertNumberValuesEquality(
      newBalances.aliceFA2.minus(oldBalances.aliceFA2),
      balancesDiffs.aliceFA2,
      "Balance of FA2 token for Alice doesn't match"
    );
    assertNumberValuesEquality(
      newBalances.aliceTez.minus(oldBalances.aliceTez).plus(totalFee),
      balancesDiffs.noFeesAliceTez,
      "TEZ balance for Alice doesn't match"
    );
    assertNumberValuesEquality(
      newBalances.contractFA2.minus(oldBalances.contractFA2),
      balancesDiffs.contractFA2,
      "Balance of FA2 token for contract doesn't match"
    );
    assertNumberValuesEquality(
      newBalances.contractTez.minus(oldBalances.contractTez),
      balancesDiffs.contractTez,
      "TEZ balance for contract doesn't match"
    );
    const { storage: currentStorage } = coinflip;
    await otherAssertions(prevStorage, currentStorage);
  }

  beforeAll(async () => {
    try {
      Tezos.setSignerProvider(signerAlice);
      console.log('Originating coinflip contract without assets...');
      const aliceEmptyCoinflip = await Coinflip.originateWithTransfers(
        Tezos,
        defaultStorage
      );
      console.log('Originating FA2 token contract...');
      const aliceFA2 = await FA2.originate(Tezos, fa2Storage);
      testFA2TokenDescriptor = {
        fA2: { address: aliceFA2.contract.address, id: new BigNumber(0) }
      };
      console.log('Originating coinflip contract with assets with empty banks...');
      const aliceAllAssetsAddedCoinflip = await Coinflip.originateWithTransfers(
        Tezos,
        makeStorage(
          [
            makeAssetEntry(TEZ_ASSET_DESCRIPTOR),
            makeAssetEntry(testFA2TokenDescriptor)
          ]
        )
      );
      console.log(
        'Originating coinflip contract with assets with non-empty banks and transfering assets to it...'
      );
      const aliceAllAssetsWithBankCoinflip = await Coinflip.originateWithTransfers(
        Tezos,
        makeStorage(
          [
            makeAssetEntry(TEZ_ASSET_DESCRIPTOR, withdrawalTestTezBank),
            makeAssetEntry(testFA2TokenDescriptor, withdrawalTestFa2TokenBank)
          ],
          withdrawalTestNetworkBank
        )
      );

      console.log('Initializing test entities...');
      accountsContractsProxies.alice = {
        emptyCoinflip: aliceEmptyCoinflip,
        fa2: aliceFA2,
        allAssetsAddedCoinflip: aliceAllAssetsAddedCoinflip,
        allAssetsWithBankCoinflip: aliceAllAssetsWithBankCoinflip
      };
      await Promise.all(
        ['bob', 'carol'].map(async alias => {
          const [
            emptyCoinflip,
            fa2,
            allAssetsAddedCoinflip,
            allAssetsWithBankCoinflip
          ] = await Promise.all([
            Coinflip.init(alias, aliceEmptyCoinflip.contractAddress),
            FA2.init(aliceFA2.contract.address, await initTezos(alias)),
            Coinflip.init(alias, aliceAllAssetsAddedCoinflip.contractAddress),
            Coinflip.init(alias, aliceAllAssetsWithBankCoinflip.contractAddress)
          ]);
          accountsContractsProxies[alias] = {
            emptyCoinflip,
            fa2,
            allAssetsAddedCoinflip,
            allAssetsWithBankCoinflip
          };
        })
      );
      console.log('General preparation to admin entrypoints tests finished');
    } catch (e) {
      console.error(e);
    }
  });

  describe('Testing entrypoint: Set_payout_quotient', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsAddedCoinflip.setPayoutQuotient(
            tezAssetId,
            defaultNewPayout
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
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
        "Should fail with 'Coinflip/payout-too-low' error for payout quotient \
equal to 1",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should fail with 'Coinflip/payout-too-low' error for payout quotient \
less than 1",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setPayoutQuotient(tezAssetId, PRECISION.minus(1)),
          'Coinflip/payout-too-low'
        )
      );

      it(
        "Should fail with 'Coinflip/payout-too-high' error for payout quotient \
greater than 2",
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
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
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
        assertNumberValuesEquality(
          tezAsset.payout_quotient,
          newTezPayoutQuotient
        );
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(
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
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsAddedCoinflip.setMaxBet(
            tezAssetId,
            defaultNewMaxBetPercentage
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
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
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
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
        "Should fail with 'Coinflip/max-bet-too-low' error for max bet \
equal to zero",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setMaxBet(tezAssetId, 0),
          'Coinflip/max-bet-too-low'
        )
      );
  
      it(
        "Should fail with 'Coinflip/max-bet-exceed' error for max bet equal to 100%",
        async () => adminErrorTestcase(
          'allAssetsAddedCoinflip',
          coinflip => coinflip.setMaxBet(tezAssetId, PRECISION),
          'Coinflip/max-bet-exceed'
        )
      );
  
      it(
        "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
greater than 100%",
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
        assertNumberValuesEquality(
          tezAsset.max_bet_percentage,
          newTezMaxBetPercentage
        );
        const testFA2Asset = allAssetsAddedCoinflip.getAssetByDescriptor(
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
      'Should fail with error if server account tries to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.bob.allAssetsAddedCoinflip.setNetworkFee(
          defaultNetworkFee
        )
      )
    );

    it(
      'Should fail with error if a non-server and non-admin account tries \
to call the entrypoint',
      async () => notAdminTestcase(
        accountsContractsProxies.carol.allAssetsAddedCoinflip.setNetworkFee(
          defaultNetworkFee
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

        assertNumberValuesEquality(
          allAssetsAddedCoinflip.storage.network_fee,
          0
        );

        await allAssetsAddedCoinflip.sendSingle(
          allAssetsAddedCoinflip.setNetworkFee(defaultNetworkFee)
        );
        await allAssetsAddedCoinflip.updateStorage();

        assertNumberValuesEquality(
          allAssetsAddedCoinflip.storage.network_fee,
          defaultNetworkFee
        );
      }
    );
  });

  describe('Testing entrypoint: Add_asset', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to add asset',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.emptyCoinflip.addAsset(
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
          "Should fail with 'Coinflip/max-bet-too-low' error for zero max bet",
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
          "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
equal to 100%",
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
          "Should fail with 'Coinflip/max-bet-exceed' error for max bet \
greater than 100%",
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
          "Should fail with 'Coinflip/payout-too-low' error for \
payout quotient equal to 1",
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
          "Should fail with 'Coinflip/payout-too-low' error for \
payout quotient less than 1",
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
          "Should fail with 'Coinflip/payout-too-high' error for \
payout quotient greater than 2",
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
          "Should fail with 'Coinflip/asset-exists' error for already added \
FA2 asset",
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
          "Should fail with 'Coinflip/asset-exists' error for already added \
TEZ asset",
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
          "Should fail with 'Coinflip/invalid-asset' error for non-existent asset",
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

        const addedAsset = emptyCoinflip.getAssetByDescriptor(
          TEZ_ASSET_DESCRIPTOR
        );
        assertNumberValuesEquality(
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
        assertNumberValuesEquality(
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

    afterAll(async () => {
      const aliceEmptyCoinflip = await Coinflip.originateWithTransfers(
        Tezos,
        defaultStorage
      );
      accountsContractsProxies.alice.emptyCoinflip = aliceEmptyCoinflip;
      await Promise.all(
        ['bob', 'carol'].map(
          async alias => {
            accountsContractsProxies[alias].emptyCoinflip = await Coinflip.init(
              alias,
              aliceEmptyCoinflip.contractAddress
            );
          }
        )
      )
    });
  });

  describe('Testing entrypoint: Add_asset_bank', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to increase bank',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsWithBankCoinflip.addAssetBank(
            tezAssetId,
            defaultAddBankAmount
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to increase bank',
        async () => notAdminTestcase(
          accountsContractsProxies.carol.allAssetsWithBankCoinflip.addAssetBank(
            tezAssetId,
            defaultAddBankAmount
          )
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/zero-amount' error when \
FA2 token amount is zero",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.addAssetBank(defaultFA2AssetId, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/zero-amount' error when TEZ amount is zero",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.addAssetBank(tezAssetId, 0, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.addAssetBank(
            defaultUnknownAssetId,
            defaultAddBankAmount
          ),
          'Coinflip/unknown-asset'
        )
      );

      it(
        "Should fail with 'Coinflip/invalid-amount' exception if TEZ amount in \
send parameters isn't equal to amount from entrypoint parameters",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.addAssetBank(
            tezAssetId,
            defaultAddBankAmount,
            defaultAddBankAmount - 1
          ),
          'Coinflip/invalid-amount'
        )
      );
    });

    it(
      'Should increase TEZ bank by specified amount',
      async () => aliceTestcaseWithBalancesDiff(
        'allAssetsWithBankCoinflip',
        {
          noFeesAliceTez: -defaultAddBankAmount,
          aliceFA2: 0,
          contractTez: defaultAddBankAmount,
          contractFA2: 0
        },
        async (coinflip) => coinflip.sendSingle(
          coinflip.addAssetBank(
            tezAssetId,
            defaultAddBankAmount,
            defaultAddBankAmount
          )
        ),
        (prevStorage, currentStorage) => {
          const { bank: prevBankFromStorage } = prevStorage.id_to_asset
            .get(tezAssetId);
          const { bank: newBankFromStorage } = currentStorage.id_to_asset
            .get(tezAssetId);
          assertNumberValuesEquality(
            newBankFromStorage.minus(prevBankFromStorage),
            defaultAddBankAmount
          );
        }
      )
    );

    it(
      'Should increase FA2 token bank by specified amount',
      async () => aliceTestcaseWithBalancesDiff(
        'allAssetsWithBankCoinflip',
        {
          noFeesAliceTez: 0,
          aliceFA2: -defaultAddBankAmount,
          contractTez: 0,
          contractFA2: defaultAddBankAmount
        },
        async (coinflip, fa2) => coinflip.sendBatch([
          fa2.updateOperators([
            {
              add_operator: {
                owner: alice.pkh,
                operator: coinflip.contractAddress,
                token_id: defaultFA2TokenId
              }
            }
          ]),
          coinflip.addAssetBank(defaultFA2AssetId, defaultAddBankAmount)
        ]),
        (prevStorage, currentStorage) => {
          const { bank: prevBankFromStorage } = prevStorage.id_to_asset
            .get(defaultFA2AssetId);
          const { bank: newBankFromStorage } = currentStorage.id_to_asset
            .get(defaultFA2AssetId);
          assertNumberValuesEquality(
            newBankFromStorage.minus(prevBankFromStorage),
            defaultAddBankAmount
          );
        }
      )
    );
  });

  describe('Testing entrypoint: Remove_asset_bank', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to increase bank',
        async () => notAdminTestcase(
          accountsContractsProxies.bob.allAssetsWithBankCoinflip
            .removeAssetBank(tezAssetId, defaultAddBankAmount
          )
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to increase bank',
        async () => notAdminTestcase(
          accountsContractsProxies.carol.allAssetsWithBankCoinflip
            .removeAssetBank(tezAssetId, defaultAddBankAmount)
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/zero-amount' error for zero amount",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.removeAssetBank(tezAssetId, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.removeAssetBank(
            defaultUnknownAssetId,
            defaultAddBankAmount
          ),
          'Coinflip/unknown-asset'
        )
      );

      it(
        "Should fail with 'Coinflip/amount-too-high' error for amount \
greater than in bank",
        async () => adminErrorTestcase(
          'allAssetsWithBankCoinflip',
          coinflip => coinflip.removeAssetBank(
            tezAssetId,
            coinflip.getBankAmount(tezAssetId).plus(1)
          ),
          'Coinflip/amount-too-high'
        )
      );
    });

    it(
      'Should decrease TEZ bank by the amount less than bank',
      async () => {
        const removeBankAmount = accountsContractsProxies
          .alice
          .allAssetsWithBankCoinflip
          .getBankAmount(tezAssetId)
          .minus(1);
        await aliceTestcaseWithBalancesDiff(
          'allAssetsWithBankCoinflip',
          {
            noFeesAliceTez: removeBankAmount,
            aliceFA2: 0,
            contractTez: removeBankAmount.times(-1),
            contractFA2: 0
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.removeAssetBank(tezAssetId, removeBankAmount)
          ),
          (prevStorage, currentStorage) => {
            const { bank: prevBankFromStorage } = prevStorage.id_to_asset
              .get(tezAssetId);
            const { bank: newBankFromStorage } = currentStorage.id_to_asset
              .get(tezAssetId);
            assertNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              removeBankAmount
            );
          }
        )
      }
    );

    it(
      'Should decrease FA2 token bank by amount equal to bank',
      async () => {
        const removeBankAmount = accountsContractsProxies
          .alice
          .allAssetsWithBankCoinflip
          .getBankAmount(defaultFA2AssetId);
        await aliceTestcaseWithBalancesDiff(
          'allAssetsWithBankCoinflip',
          {
            noFeesAliceTez: 0,
            aliceFA2: removeBankAmount,
            contractTez: 0,
            contractFA2: removeBankAmount.times(-1)
          },
          async coinflip => coinflip.sendSingle(
            coinflip.removeAssetBank(defaultFA2AssetId, removeBankAmount)
          ),
          (prevStorage, currentStorage) => {
            const { bank: prevBankFromStorage } = prevStorage.id_to_asset
              .get(defaultFA2AssetId);
            const { bank: newBankFromStorage } = currentStorage.id_to_asset
              .get(defaultFA2AssetId);
            assertNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              removeBankAmount
            );
          }
        );
      }
    );
  });
});
