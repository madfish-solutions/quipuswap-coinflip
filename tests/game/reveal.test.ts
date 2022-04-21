import assert, { deepEqual } from 'assert';
import BigNumber from 'bignumber.js';

import accounts from '../../scripts/sandbox/accounts';
import {
  makeAssetsWithGamesCoinflip,
  makeAssetRecord,
  makeFA2
} from "../account-contracts-proxies";
import { Coinflip, TEZ_ASSET } from "../coinflip";
import {
  defaultFA2AssetId,
  defaultFA2TokenId,
  defaultPayout,
  PRECISION,
  testGames,
  tezAssetId
} from "../constants";
import {
  testcaseWithBalancesDiff,
  assertNumberValuesEquality,
  notServerTestcase,
  serverErrorTestcase
} from '../helpers';
import { FA2 } from "../helpers/FA2";

describe('Coinflip reveal test', function () {
  let coinflips: Record<string, Coinflip> = {};
  let fa2Wrappers: Record<string, FA2> = {};

  async function headTailTestcase(
    revealSide: 'head' | 'tail',
    gamesIndices: number[]
  ) {
    const expectedBalancesDiffs = {
      alice: { tez: 0, fa2: 0 },
      bob: { tez: 0, fa2: 0 },
      carol: { tez: 0, fa2: 0 },
      contract: { tez: 0, fa2: 0 }
    };

    const reveals = gamesIndices.map(
      (gameIndex, i) => ({
        game_id: gameIndex,
        random_value: new BigNumber(revealSide === 'head' ? 0 : 50)
          .plus(i % 2 === 0 ? 0 : 49)
          .plus(100 * Math.floor(i / 2))
      })
    );

    const gamesToPick = testGames.filter(
      (_game, index) => gamesIndices.includes(index)
    );
    gamesToPick.forEach(
      ({ bet_coin_side, gamer, asset_id, bid_size }) => {
        if (revealSide in bet_coin_side) {
          const accountAlias = Object.keys(accounts).find(
            alias => accounts[alias].pkh === gamer
          );
          const balanceDiff = bid_size.times(defaultPayout)
            .idiv(PRECISION)
            .toNumber();
          const key = asset_id.eq(tezAssetId) ? 'tez' : 'fa2';
          expectedBalancesDiffs[accountAlias][key] += balanceDiff;
          expectedBalancesDiffs.contract[key] -= balanceDiff;
        }
      }
    );

    return testcaseWithBalancesDiff(
      fa2Wrappers,
      coinflips,
      expectedBalancesDiffs,
      (userCoinflip) => userCoinflip.sendSingle(userCoinflip.reveal(reveals)),
      async (prevStorage, userCoinflip) => {
        const { id_to_asset: prevIdToAsset } = prevStorage;
        const gamesKeys = gamesIndices.map(x => x.toString());
        await userCoinflip.updateStorage({
          games: gamesKeys
        });
        const { games, id_to_asset: idToAsset } = userCoinflip.storage;
        const newGames = gamesKeys.map(key => games.get(key));
        assert(newGames.every(({ status, bet_coin_side }) => {
          const statusName = revealSide in bet_coin_side ? 'won' : 'lost';
          return statusName in status;
        }));
        newGames.forEach(({ bet_coin_side: newBetCoinSide }, index) => {
          const expectedSide = Object.keys(gamesToPick[index].bet_coin_side)[0];
          return expectedSide in newBetCoinSide;
        });
        deepEqual(
          newGames.map(({ status, bet_coin_side, ...restProps }) => restProps),
          gamesToPick.map(
            ({ status, bet_coin_side, ...restProps }) => restProps
          )
        );

        const { bank: prevTezBank } = prevIdToAsset.get(tezAssetId);
        const { bank: prevFA2Bank } = prevIdToAsset.get(defaultFA2AssetId);
        const { bank: tezBank } = idToAsset.get(tezAssetId);
        const { bank: fa2Bank } = idToAsset.get(defaultFA2AssetId);
        assertNumberValuesEquality(
          tezBank.minus(prevTezBank),
          gamesToPick
            .reduce(
            (sum, { bet_coin_side, asset_id, bid_size }) => {
              if (asset_id.toFixed() !== tezAssetId) {
                return sum;
              }

              return revealSide in bet_coin_side
                ? sum.minus(
                    bid_size
                      .times(defaultPayout.minus(PRECISION))
                      .idiv(PRECISION)
                  )
                : sum.plus(bid_size);
            },
            new BigNumber(0)
          )
        );
        assertNumberValuesEquality(
          fa2Bank.minus(prevFA2Bank),
          gamesToPick
            .reduce(
            (sum, { bet_coin_side, asset_id, bid_size }) => {
              if (asset_id.toFixed() !== defaultFA2AssetId) {
                return sum;
              }

              return revealSide in bet_coin_side
                ? sum.minus(
                    bid_size
                      .times(defaultPayout.minus(PRECISION))
                      .idiv(PRECISION)
                  )
                : sum.plus(bid_size);
            },
            new BigNumber(0)
          )
        );
      },
      'bob'
    );
  }

  beforeAll(async () => {
    fa2Wrappers = await makeFA2();
    coinflips = await makeAssetsWithGamesCoinflip(
      fa2Wrappers.alice.contract.address
    );
  });

  describe('Testing permissions control', () => {
    it(
      'Should fail with error if admin account tries to call the entrypoint',
      async () => notServerTestcase(
        coinflips.alice.reveal([{ game_id: 2, random_value: 50 }])
      )
    );

    it(
      'Should fail with error if a non-server and non-admin account \
tries to increase bank',
      async () => notServerTestcase(
        coinflips.carol.reveal([{ game_id: 2, random_value: 50 }])
      )
    );
  });

  describe('Testing parameters validation', () => {
    beforeAll(async () => {
      coinflips = await makeAssetsWithGamesCoinflip(
        fa2Wrappers.alice.contract.address
      );
    });

    it(
      "Should fail with 'Coinflip/unknown-game' error for unknown game",
      async () => serverErrorTestcase(
        coinflips,
        coinflip => coinflip.reveal([
          { game_id: testGames.length, random_value: 50 }
        ]),
        'Coinflip/unknown-game'
      )
    );

    it(
      "Should fail with 'Coinflip/empty-list' for empty reveals list",
      async () => serverErrorTestcase(
        coinflips,
        coinflip => coinflip.reveal([]),
        'Coinflip/empty-list'
      )
    );

    it(
      "Should fail with 'Coinflip/game-finished' error if at least one game to reveal is already won",
      async () => serverErrorTestcase(
        coinflips,
        coinflip => coinflip.reveal([
          { game_id: 0, random_value: 50 },
          { game_id: 2, random_value: 50 },
          { game_id: 4, random_value: 50 }
        ]),
        'Coinflip/game-finished'
      )
    );

    it(
      "Should fail with 'Coinflip/game-finished' error if at least one game to reveal is already lost",
      async () => serverErrorTestcase(
        coinflips,
        coinflip => coinflip.reveal([
          { game_id: 1, random_value: 50 },
          { game_id: 2, random_value: 50 },
          { game_id: 4, random_value: 50 }
        ]),
        'Coinflip/game-finished'
      )
    );
  });

  describe('Win cases', () => {
    it(
      "Should make a game with bet for 'head' coin side won if random_value % 100 < 50",
      async () => headTailTestcase('head', [2, 3, 4, 5])
    );

    it(
      "Should make a game with bet for 'tail' coin side won if random_value % 100 >= 50",
      async () => headTailTestcase('tail', [6, 7, 8, 9])
    );
  });

  describe('Lose cases', () => {
    it(
      "Should make a game with bet for 'head' coin side lost if random_value % 100 >= 50",
      async () => headTailTestcase('tail', [10, 11, 12, 13])
    );

    it(
      "Should make a game with bet for 'tail' coin side lost if random_value % 100 < 50",
      async () => headTailTestcase('head', [14, 15, 16, 17])
    );
  });

  describe('Crash cases', () => {
    let localCoinflips: Record<string, Coinflip> = {};

    beforeAll(async () => {
      localCoinflips = await makeAssetsWithGamesCoinflip(
        fa2Wrappers.alice.contract.address,
        defaultFA2TokenId,
        [
          {
            asset_id: new BigNumber(0),
            gamer: accounts.alice.pkh,
            start: '2022-04-19T16:19:00.000Z',
            bid_size: new BigNumber(160),
            bet_coin_side: { head: Symbol() },
            status: { started: Symbol() }
          }
        ],
        [makeAssetRecord(TEZ_ASSET, 79)]
      );
    });

    it(
      "Should fail with 'Coinflip/cannot-pay' method if bank is not enough to pay reward",
      async () => serverErrorTestcase(
        localCoinflips,
        coinflip => coinflip.reveal([{ game_id: 0, random_value: 0 }]),
        'Coinflip/cannot-pay'
      )
    );
  });
})
