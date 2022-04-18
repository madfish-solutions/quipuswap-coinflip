import { TransactionOperation } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { Tezos } from '../utils/cli';
import { Coinflip, CoinflipStorage } from '../coinflip';
import { FA2 } from '../helpers/FA2';
import {
  adminErrorTestcase,
  assertNumberValuesEquality,
  BatchWalletOperation,
  getTotalFee,
  notAdminTestcase
} from '../helpers';
import { alice } from '../../scripts/sandbox/accounts';
import {
  defaultFA2AssetId,
  defaultFA2TokenId,
  defaultUnknownAssetId,
  tezAssetId
} from '../constants';
import {
  CoinflipType,
  makeAllAssetsWithBankCoinflip,
  makeFA2,
} from '../account-contracts-proxies';

export const defaultAddBankAmount = 700;
export const withdrawalTestNetworkBank = 2000;
export const withdrawalTestTezBank = 5000;
export const withdrawalTestFa2TokenBank = 1000;

async function aliceTestcaseWithBalancesDiff(
  fa2Wrappers: Record<string, FA2>,
  coinflips: Record<string, Coinflip>,
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
  const fa2 = fa2Wrappers.alice;
  const coinflip = coinflips.alice;
  const { contractAddress, storage: prevStorage } = coinflip;
  await fa2.updateStorage({ account_info: [alice.pkh, contractAddress] });
  const oldBalances = {
    aliceTez: await Tezos.tz.getBalance(alice.pkh),
    aliceFA2: fa2.getTokenBalance(alice.pkh, String(defaultFA2TokenId)),
    contractTez: await Tezos.tz.getBalance(contractAddress),
    contractFA2: fa2.getTokenBalance(contractAddress, String(defaultFA2TokenId))
  };
  const totalFee = await getTotalFee(await operation(coinflip, fa2));
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

describe('Coinflip admin bank entrypoints test', function () {
  let fa2Wrappers: Record<string, FA2> = {};
  let coinflips: Record<string, Coinflip> = {};

  beforeAll(async () => {
    fa2Wrappers = await makeFA2();
    coinflips = await makeAllAssetsWithBankCoinflip(
      fa2Wrappers.alice.contract.address
    );
  });

  describe('Testing entrypoint: Add_asset_bank', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to increase bank',
        async () => notAdminTestcase(
          coinflips.bob.addAssetBank(tezAssetId, defaultAddBankAmount)
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to increase bank',
        async () => notAdminTestcase(
          coinflips.carol.addAssetBank(tezAssetId, defaultAddBankAmount)
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/zero-amount' error when \
FA2 token amount is zero",
        async () => adminErrorTestcase(
          coinflips,
          coinflip => coinflip.addAssetBank(defaultFA2AssetId, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/zero-amount' error when TEZ amount is zero",
        async () => adminErrorTestcase(
          coinflips,
          coinflip => coinflip.addAssetBank(tezAssetId, 0, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          coinflips,
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
          coinflips,
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
        fa2Wrappers,
        coinflips,
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
        fa2Wrappers,
        coinflips,
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
          coinflips.bob.removeAssetBank(tezAssetId, defaultAddBankAmount)
        )
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to increase bank',
        async () => notAdminTestcase(
          coinflips.carol.removeAssetBank(tezAssetId, defaultAddBankAmount)
        )
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/zero-amount' error for zero amount",
        async () => adminErrorTestcase(
          coinflips,
          coinflip => coinflip.removeAssetBank(tezAssetId, 0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
        async () => adminErrorTestcase(
          coinflips,
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
          coinflips,
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
        const removeBankAmount = coinflips
          .alice
          .getBankAmount(tezAssetId)
          .minus(1);
        await aliceTestcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
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
        const removeBankAmount = coinflips.alice.getBankAmount(
          defaultFA2AssetId
        );
        await aliceTestcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
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

  describe('Testing entrypoint: Withdraw_network_fee', () => {
    describe('Testing permissions control', () => {
      it(
        'Should fail with error if server account tries to call the entrypoint',
        async () => notAdminTestcase(coinflips.bob.withdrawNetworkFee(1))
      );
  
      it(
        'Should fail with error if a non-server and non-admin account \
tries to call the entrypoint',
        async () => notAdminTestcase(coinflips.carol.withdrawNetworkFee(1))
      );
    });

    describe('Testing parameters validation', () => {
      it(
        "Should fail with 'Coinflip/zero-amount' error for zero amount",
        async () => adminErrorTestcase(
          coinflips,
          coinflip => coinflip.withdrawNetworkFee(0),
          'Coinflip/zero-amount'
        )
      );

      it(
        "Should fail with 'Coinflip/amount-too-high' error for amount \
greater than in bank",
        async () => adminErrorTestcase(
          coinflips,
          coinflip => coinflip.removeAssetBank(
            tezAssetId,
            coinflip.storage.network_bank.plus(1)
          ),
          'Coinflip/amount-too-high'
        )
      );
    });

    it(
      'Should withdraw the amount that is less than network bank or equal to it',
      async () => {
        const firstWithdrawalAmount = 100;
        const secondWithdrawalAmount = withdrawalTestNetworkBank - firstWithdrawalAmount;

        await aliceTestcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            noFeesAliceTez: firstWithdrawalAmount,
            aliceFA2: 0,
            contractTez: -firstWithdrawalAmount,
            contractFA2: 0
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.withdrawNetworkFee(firstWithdrawalAmount)
          ),
          (prevStorage, currentStorage) => {
            const { network_bank: prevBankFromStorage } = prevStorage;
            const { network_bank: newBankFromStorage } = currentStorage;
            assertNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              firstWithdrawalAmount
            );
          }
        );
        await aliceTestcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            noFeesAliceTez: secondWithdrawalAmount,
            aliceFA2: 0,
            contractTez: -secondWithdrawalAmount,
            contractFA2: 0
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.withdrawNetworkFee(secondWithdrawalAmount)
          ),
          (prevStorage, currentStorage) => {
            const { network_bank: prevBankFromStorage } = prevStorage;
            const { network_bank: newBankFromStorage } = currentStorage;
            assertNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              secondWithdrawalAmount
            );
          }
        );
      }
    );
  });
});
