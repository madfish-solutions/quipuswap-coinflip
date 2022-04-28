import { Coinflip } from '../coinflip';
import { FA2 } from '../helpers/FA2';
import {
  adminErrorTestcase,
  testcaseWithBalancesDiff,
  expectNumberValuesEquality,
  notAdminTestcase
} from '../helpers';
import { alice } from '../../scripts/sandbox/accounts';
import {
  defaultFA2AssetId,
  defaultFA2TokenId,
  tezAssetId
} from '../constants';
import {
  makeAllAssetsWithBankCoinflip,
  makeFA2,
} from '../account-contracts-proxies';

const defaultAddBankAmount = 700;
const withdrawalTestNetworkBank = 2000;
const unknownAssetId = '3';

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
            unknownAssetId,
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
      async () => testcaseWithBalancesDiff(
        fa2Wrappers,
        coinflips,
        {
          alice: {
            tez: -defaultAddBankAmount,
            fa2: 0
          },
          contract: {
            tez: defaultAddBankAmount,
            fa2: 0
          }
        },
        async (coinflip) => coinflip.sendSingle(
          coinflip.addAssetBank(
            tezAssetId,
            defaultAddBankAmount,
            defaultAddBankAmount
          )
        ),
        (prevStorage, userCoinflip) => {
          const { storage: currentStorage } = userCoinflip;
          const { bank: prevBankFromStorage } = prevStorage.id_to_asset
            .get(tezAssetId);
          const { bank: newBankFromStorage } = currentStorage.id_to_asset
            .get(tezAssetId);
          expectNumberValuesEquality(
            newBankFromStorage.minus(prevBankFromStorage),
            defaultAddBankAmount
          );
        }
      )
    );

    it(
      'Should increase FA2 token bank by specified amount',
      async () => testcaseWithBalancesDiff(
        fa2Wrappers,
        coinflips,
        {
          alice: {
            tez: 0,
            fa2: -defaultAddBankAmount
          },
          contract: {
            tez: 0,
            fa2: defaultAddBankAmount
          }
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
        (prevStorage, userCoinflip) => {
          const { storage: currentStorage } = userCoinflip;
          const { bank: prevBankFromStorage } = prevStorage.id_to_asset
            .get(defaultFA2AssetId);
          const { bank: newBankFromStorage } = currentStorage.id_to_asset
            .get(defaultFA2AssetId);
          expectNumberValuesEquality(
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
            unknownAssetId,
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
        await testcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            alice: {
              tez: removeBankAmount,
              fa2: 0
            },
            contract: {
              tez: removeBankAmount.times(-1),
              fa2: 0
            }
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.removeAssetBank(tezAssetId, removeBankAmount)
          ),
          (prevStorage, userCoinflip) => {
            const { storage: currentStorage } = userCoinflip;
            const { bank: prevBankFromStorage } = prevStorage.id_to_asset
              .get(tezAssetId);
            const { bank: newBankFromStorage } = currentStorage.id_to_asset
              .get(tezAssetId);
            expectNumberValuesEquality(
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
        await testcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            alice: {
              tez: 0,
              fa2: removeBankAmount
            },
            contract: {
              tez: 0,
              fa2: removeBankAmount.times(-1)
            }
          },
          async coinflip => coinflip.sendSingle(
            coinflip.removeAssetBank(defaultFA2AssetId, removeBankAmount)
          ),
          (prevStorage, userCoinflip) => {
            const { storage: currentStorage } = userCoinflip;
            const { bank: prevBankFromStorage } = prevStorage.id_to_asset
              .get(defaultFA2AssetId);
            const { bank: newBankFromStorage } = currentStorage.id_to_asset
              .get(defaultFA2AssetId);
            expectNumberValuesEquality(
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

        await testcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            alice: {
              tez: firstWithdrawalAmount,
              fa2: 0
            },
            contract: {
              tez: -firstWithdrawalAmount,
              fa2: 0
            }
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.withdrawNetworkFee(firstWithdrawalAmount)
          ),
          (prevStorage, userCoinflip) => {
            const { storage: currentStorage } = userCoinflip;
            const { network_bank: prevBankFromStorage } = prevStorage;
            const { network_bank: newBankFromStorage } = currentStorage;
            expectNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              firstWithdrawalAmount
            );
          }
        );
        await testcaseWithBalancesDiff(
          fa2Wrappers,
          coinflips,
          {
            alice: {
              tez: secondWithdrawalAmount,
              fa2: 0
            },
            contract: {
              tez: -secondWithdrawalAmount,
              fa2: 0
            }
          },
          async (coinflip) => coinflip.sendSingle(
            coinflip.withdrawNetworkFee(secondWithdrawalAmount)
          ),
          (prevStorage, userCoinflip) => {
            const { storage: currentStorage } = userCoinflip;
            const { network_bank: prevBankFromStorage } = prevStorage;
            const { network_bank: newBankFromStorage } = currentStorage;
            expectNumberValuesEquality(
              prevBankFromStorage.minus(newBankFromStorage),
              secondWithdrawalAmount
            );
          }
        );
      }
    );
  });
});
