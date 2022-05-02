import assert, { deepEqual } from 'assert';
import BigNumber from 'bignumber.js';

import accounts, { alice } from '../../scripts/sandbox/accounts';
import { Tezos } from '../../utils/helpers';
import {
  makeAllAssetsWithBankCoinflip,
  makeFA2
} from "../account-contracts-proxies";
import { Coinflip } from "../coinflip";
import {
  defaultFA2AssetId,
  defaultFA2TokenId,
  testMaxFA2Bet,
  tezAssetId
} from "../constants";
import {
  testcaseWithBalancesDiff,
  expectNumberValuesEquality,
  entrypointErrorTestcase
} from '../helpers';
import { FA2 } from "../helpers/FA2";

const defaultBetSize = 100;
const unknownAssetId = '3';

describe('Coinflip bet test', function () {
  let coinflips: Record<string, Coinflip> = {};
  let fa2Wrappers: Record<string, FA2> = {};

  async function successfulBetTestcase(
    localCoinflips: Record<string, Coinflip>,
    betSize: number,
    assetId: string
  ) {
    const assetIsTez = assetId === tezAssetId;
    const mutezAmount = (assetIsTez ? betSize : 0) +
      localCoinflips.alice.storage.network_fee.toNumber();
    await testcaseWithBalancesDiff(
      fa2Wrappers,
      localCoinflips,
      {
        alice: { tez: -mutezAmount, fa2: assetIsTez ? 0 : -betSize },
        contract: { tez: mutezAmount, fa2: assetIsTez ? 0 : betSize }
      },
      (coinflip, fa2) => assetIsTez
        ? coinflip.sendSingle(
          coinflip.bet(
            tezAssetId,
            betSize,
            { head: Symbol() },
            mutezAmount
          )
        )
        : coinflip.sendBatch([
          fa2.updateOperators([
            {
              add_operator: {
                token_id: defaultFA2TokenId,
                owner: alice.pkh,
                operator: coinflip.contractAddress
              }
            }
          ]),
          coinflip.bet(
            assetId,
            betSize,
            { head: Symbol() },
            mutezAmount
          )
        ]),
      async (prevStorage, userCoinflip) => {
        const blockHeader = await Tezos.rpc.getBlockHeader();
        const expectedStart = new Date(blockHeader.timestamp).toISOString();
        const {
          games_counter: prevGamesCounter,
          network_bank: prevNetworkBank,
          id_to_asset: prevIdToAsset
        } = prevStorage;
        const {
          bank: prevBank,
          total_won_amt: prevTotalWonAmt,
          total_lost_amt: prevTotalLostAmt,
          games_count: prevAssetGamesCount
        } = prevIdToAsset.get(assetId);
        await userCoinflip.updateStorage({
          games: [prevGamesCounter.toFixed()]
        });
        const {
          games_counter: currentGamesCounter,
          games,
          network_bank: networkBank,
          network_fee: networkFee,
          id_to_asset: idToAsset,
        } = userCoinflip.storage;
        const {
          bank: currentBank,
          total_won_amt: totalWonAmt,
          total_lost_amt: totalLostAmt,
          games_count: assetGamesCount
        } = idToAsset.get(assetId);
        expect({
          currentBank,
          totalWonAmt,
          totalLostAmt,
          assetGamesCount
        }).toEqual({
          currentBank: prevBank,
          totalWonAmt: prevTotalWonAmt,
          totalLostAmt: prevTotalLostAmt,
          assetGamesCount: prevAssetGamesCount.plus(1)
        });
        expectNumberValuesEquality(
          currentGamesCounter.minus(prevGamesCounter),
          1
        );
        expectNumberValuesEquality(
          networkBank.minus(prevNetworkBank),
          networkFee
        );
        const newGame = games.get(prevGamesCounter.toFixed());
        expect(newGame).toBeDefined();
        const { bet_coin_side, status, ...restGameProps } = newGame;
        expect(restGameProps).toEqual({
          asset_id: new BigNumber(assetId),
          gamer: alice.pkh,
          start: expectedStart,
          bid_size: new BigNumber(betSize)
        });
        expect('head' in bet_coin_side).toEqual(true);
        expect('started' in status).toEqual(true);
      }
    )
  }

  beforeAll(async () => {
    fa2Wrappers = await makeFA2();
    coinflips = await makeAllAssetsWithBankCoinflip(
      fa2Wrappers.alice.contract.address
    );
  });

  it('Should allow bets for all users', async () => {
    await Promise.all(['alice', 'bob', 'carol'].map(
      async alias => {
        const coinflip = coinflips[alias];
        await coinflip.updateStorage();
        const fa2 = fa2Wrappers[alias];

        return coinflip.sendBatch([
          fa2.updateOperators([{
            add_operator: {
              token_id: defaultFA2TokenId,
              owner: accounts[alias].pkh,
              operator: coinflip.contractAddress
            }
          }]),
          coinflip.bet(
            defaultFA2AssetId,
            defaultBetSize,
            { head: Symbol() },
            coinflip.storage.network_fee.toNumber()
          )
        ]);
      }
    ));
  });

  describe('Testing parameters validation', () => {
    beforeAll(async () => {
      coinflips = await makeAllAssetsWithBankCoinflip(
        fa2Wrappers.alice.contract.address
      );
    });

    it(
      "Should fail with 'Coinflip/zero-amount' error when bid size is zero",
      async () => entrypointErrorTestcase(
        coinflips.alice.bet(
          defaultFA2AssetId,
          0,
          { head: Symbol() },
          coinflips.alice.storage.network_fee.toNumber()
        ),
        'Coinflip/zero-amount'
      )
    );

    it(
      "Should fail with 'Coinflip/bid-too-high' error when bid is too high",
      async () => entrypointErrorTestcase(
        coinflips.bob.bet(
          defaultFA2AssetId,
          testMaxFA2Bet + 1,
          { tail: Symbol() },
          coinflips.bob.storage.network_fee.toNumber()
        ),
        'Coinflip/bid-too-high'
      )
    );

    it(
      "Should fail with 'Coinflip/invalid-amount' error for TEZ bid when \
amount is less than bid size + network fee",
      async () => entrypointErrorTestcase(
        coinflips.carol.bet(
          tezAssetId,
          defaultBetSize,
          { head: Symbol() },
          coinflips.carol.storage.network_fee.toNumber() + defaultBetSize - 1
        ),
        'Coinflip/invalid-amount'
      )
    );

    it(
      "Should fail with 'Coinflip/invalid-amount' error for TEZ bid when \
amount is greater than bid size + network fee",
      async () => entrypointErrorTestcase(
        coinflips.carol.bet(
          tezAssetId,
          defaultBetSize,
          { head: Symbol() },
          coinflips.carol.storage.network_fee.toNumber() + defaultBetSize + 1
        ),
        'Coinflip/invalid-amount'
      )
    );

    it(
      "Should fail with 'Coinflip/invalid-amount' error for FA2 token bid when \
amount is less than bid size + network fee",
      async () => entrypointErrorTestcase(
        coinflips.carol.bet(
          defaultFA2AssetId,
          defaultBetSize,
          { head: Symbol() },
          coinflips.carol.storage.network_fee.toNumber() - 1
        ),
        'Coinflip/invalid-amount'
      )
    );

    it(
      "Should fail with 'Coinflip/invalid-amount' error for FA2 token bid when \
amount is greater than bid size + network fee",
      async () => entrypointErrorTestcase(
        coinflips.carol.bet(
          defaultFA2AssetId,
          defaultBetSize,
          { head: Symbol() },
          coinflips.carol.storage.network_fee.toNumber() + 1
        ),
        'Coinflip/invalid-amount'
      )
    );

    it(
      "Should fail with 'Coinflip/unknown-asset' error for unknown asset",
      async () => entrypointErrorTestcase(
        coinflips.alice.bet(
          unknownAssetId,
          defaultBetSize,
          { head: Symbol() },
          coinflips.alice.storage.network_fee.toNumber()
        ),
        'Coinflip/unknown-asset'
      )
    );

    it(
      "Should fail with 'Coinflip/asset-paused' error for paused asset",
      async () => entrypointErrorTestcase(
        coinflips.alice.bet(
          2,
          defaultBetSize,
          { head: Symbol() },
          coinflips.alice.storage.network_fee.toNumber()
        ),
        'Coinflip/asset-paused'
      )
    );
  });

  it(
    'Should make a new record for bid and increase network bank for TEZ bid',
    async () => successfulBetTestcase(
      coinflips,
      defaultBetSize,
      tezAssetId
    )
  );

  it(
    'Should make a new record, increase network bank, and take tokens for FA2 token bid',
    async () => successfulBetTestcase(
      coinflips,
      defaultBetSize,
      defaultFA2AssetId
    )
  );
});
