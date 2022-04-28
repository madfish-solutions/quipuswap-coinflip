import assert, { deepEqual } from 'assert';
import BigNumber from 'bignumber.js';

import accounts, { alice } from '../../scripts/sandbox/accounts';
import { Tezos } from '../../utils/helpers';
import {
  makeAllAssetsWithBankCoinflip,
  makeAssetsWithGamesCoinflip,
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
  assertNumberValuesEquality,
  entrypointErrorTestcase
} from '../helpers';
import { FA2 } from "../helpers/FA2";

const defaultBetSize = 100;
const unknownAssetId = '3';

describe('Coinflip bet test', function () {
  let coinflips: Record<string, Coinflip> = {};
  let oneGameCoinflips: Record<string, Coinflip> = {};
  let fa2Wrappers: Record<string, FA2> = {};

  beforeAll(async () => {
    fa2Wrappers = await makeFA2();
    coinflips = await makeAllAssetsWithBankCoinflip(
      fa2Wrappers.alice.contract.address
    );
    oneGameCoinflips = await makeAssetsWithGamesCoinflip(
      fa2Wrappers.alice.contract.address,
      defaultFA2TokenId,
      [
        {
          asset_id: new BigNumber(tezAssetId),
          gamer: alice.pkh,
          start: '2022-04-28T18:21:00Z',
          bid_size: new BigNumber(defaultBetSize),
          bet_coin_side: { head: Symbol() },
          status: { started: Symbol() }
        }
      ]
    );
  });

  it('Should allow bets for users of all types', async () => {
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
    'Should make a new record for bid, update record for gamer if present, \
and increase network bank for TEZ bid',
    async () => {
      const mutezAmount = defaultBetSize +
        coinflips.alice.storage.network_fee.toNumber();
      await testcaseWithBalancesDiff(
        fa2Wrappers,
        oneGameCoinflips,
        {
          alice: {
            tez: -mutezAmount,
            fa2: 0
          },
          contract: {
            tez: mutezAmount,
            fa2: 0
          }
        },
        (coinflip) => coinflip.sendSingle(
          coinflip.bet(
            tezAssetId,
            defaultBetSize,
            { head: Symbol() },
            mutezAmount
          )
        ),
        async (prevStorage, userCoinflip) => {
          const expectedStart = new Date(
            (await Tezos.rpc.getBlockHeader()).timestamp
          ).toISOString();
          const {
            games_counter: prevGamesCounter,
            network_bank: prevNetworkBank,
            id_to_asset: prevIdToAsset,
            gamers_stats: prevGamersStats
          } = prevStorage;
          const prevTezBank = prevIdToAsset.get(tezAssetId).bank;
          await userCoinflip.updateStorage(
            { games: [prevGamesCounter.toFixed()] }
          );
          const {
            games_counter: currentGamesCounter,
            games,
            network_bank: networkBank,
            network_fee: networkFee,
            id_to_asset: idToAsset,
            gamers_stats: gamersStats
          } = userCoinflip.storage;
          const currentTezBank = idToAsset.get(tezAssetId).bank;
          assertNumberValuesEquality(
            prevTezBank,
            currentTezBank
          );
          assertNumberValuesEquality(
            currentGamesCounter.minus(prevGamesCounter),
            1
          );
          assertNumberValuesEquality(
            networkBank.minus(prevNetworkBank),
            networkFee
          );
          const newGame = games.get(prevGamesCounter.toFixed());
          assert(newGame !== undefined);
          const { bet_coin_side, status, ...restProps } = newGame;
          deepEqual(
            restProps,
            {
              asset_id: new BigNumber(tezAssetId),
              gamer: alice.pkh,
              start: expectedStart,
              bid_size: new BigNumber(defaultBetSize)
            }
          );
          assert('head' in bet_coin_side);
          assert('started' in status);
          const newGamerStats = gamersStats.get(
            Coinflip.getAccountAssetIdPairKey(alice.pkh, tezAssetId)
          );
          const prevGamerStats = prevGamersStats.get(
            Coinflip.getAccountAssetIdPairKey(alice.pkh, tezAssetId)
          );
          deepEqual(
            newGamerStats,
            {
              last_game_id: prevGamesCounter,
              games_count: prevGamerStats.games_count.plus(1),
              total_won_amt: prevGamerStats.total_won_amt,
              total_lost_amt: prevGamerStats.total_lost_amt
            }
          );
        }
      );
    }
  );

  it(
    'Should make a new record, a new one for gamer if there is none, and \
increase network bank for TEZ token bid',
    async () => {
      const mutezAmount = defaultBetSize +
        coinflips.alice.storage.network_fee.toNumber();
      await testcaseWithBalancesDiff(
        fa2Wrappers,
        coinflips,
        {
          alice: {
            tez: -mutezAmount,
            fa2: 0
          },
          contract: {
            tez: mutezAmount,
            fa2: 0
          }
        },
        (coinflip) => coinflip.sendSingle(
          coinflip.bet(
            tezAssetId,
            defaultBetSize,
            { head: Symbol() },
            mutezAmount
          )
        ),
        async (prevStorage, userCoinflip) => {
          const blockHeader = await Tezos.rpc.getBlockHeader();
          const expectedStart = new Date(blockHeader.timestamp).toISOString();
          const {
            games_counter: prevGamesCounter,
            network_bank: prevNetworkBank,
            id_to_asset: prevIdToAsset
          } = prevStorage;
          const prevTezBank = prevIdToAsset.get(tezAssetId).bank;
          await userCoinflip.updateStorage(
            { games: [prevGamesCounter.toFixed()] }
          );
          const {
            games_counter: currentGamesCounter,
            games,
            network_bank: networkBank,
            network_fee: networkFee,
            id_to_asset: idToAsset,
            gamers_stats: gamersStats
          } = userCoinflip.storage;
          const currentTezBank = idToAsset.get(tezAssetId).bank;
          assertNumberValuesEquality(
            prevTezBank,
            currentTezBank
          );
          assertNumberValuesEquality(
            currentGamesCounter.minus(prevGamesCounter),
            1
          );
          assertNumberValuesEquality(
            networkBank.minus(prevNetworkBank),
            networkFee
          );
          const newGame = games.get(prevGamesCounter.toFixed());
          const newGamerStats = gamersStats.get(
            Coinflip.getAccountAssetIdPairKey(alice.pkh, tezAssetId)
          );
          assert(newGame !== undefined);
          assert(newGamerStats !== undefined);
          const { bet_coin_side, status, ...restProps } = newGame;
          deepEqual(
            restProps,
            {
              asset_id: new BigNumber(tezAssetId),
              gamer: alice.pkh,
              start: expectedStart,
              bid_size: new BigNumber(defaultBetSize)
            }
          );
          assert('head' in bet_coin_side);
          assert('started' in status);
          deepEqual(
            newGamerStats,
            {
              last_game_id: prevGamesCounter,
              games_count: new BigNumber(1),
              total_won_amt: new BigNumber(0),
              total_lost_amt: new BigNumber(0)
            }
          );
        }
      );
    }
  );

  it(
    'Should make a new record, a new one for gamer if there is none, \
increase network bank, and take tokens for FA2 token bid',
    async () => {
      const mutezAmount = coinflips.alice.storage.network_fee.toNumber();
      await testcaseWithBalancesDiff(
        fa2Wrappers,
        coinflips,
        {
          alice: {
            tez: -mutezAmount,
            fa2: -defaultBetSize
          },
          contract: {
            tez: mutezAmount,
            fa2: defaultBetSize
          }
        },
        (coinflip, fa2) => coinflip.sendBatch([
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
            defaultFA2AssetId,
            defaultBetSize,
            { tail: Symbol() },
            mutezAmount
          )
        ]),
        async (prevStorage, userCoinflip) => {
          const expectedStart = new Date(
            (await Tezos.rpc.getBlockHeader()).timestamp
          ).toISOString();
          const {
            games_counter: prevGamesCounter,
            network_bank: prevNetworkBank,
            id_to_asset: prevIdToAsset
          } = prevStorage;
          const prevFA2Bank = prevIdToAsset.get(defaultFA2AssetId).bank;
          await userCoinflip.updateStorage(
            { games: [prevGamesCounter.toFixed()] }
          );
          const {
            games_counter: currentGamesCounter,
            games,
            network_bank: networkBank,
            network_fee: networkFee,
            id_to_asset: idToAsset,
            gamers_stats: gamersStats
          } = userCoinflip.storage;
          const currentFA2Bank = idToAsset.get(defaultFA2AssetId).bank;
          assertNumberValuesEquality(prevFA2Bank, currentFA2Bank);
          assertNumberValuesEquality(
            currentGamesCounter.minus(prevGamesCounter),
            1
          );
          assertNumberValuesEquality(
            networkBank.minus(prevNetworkBank),
            networkFee
          );
          const newGame = games.get(prevGamesCounter.toFixed());
          assert(newGame !== undefined);
          const { bet_coin_side, status, ...restProps } = newGame;
          assert('tail' in bet_coin_side);
          assert('started' in status);
          deepEqual(
            restProps,
            {
              asset_id: new BigNumber(defaultFA2AssetId),
              gamer: alice.pkh,
              start: expectedStart,
              bid_size: new BigNumber(defaultBetSize)
            }
          );
          const newGamerStats = gamersStats.get(
            Coinflip.getAccountAssetIdPairKey(alice.pkh, defaultFA2AssetId)
          );
          deepEqual(
            newGamerStats,
            {
              last_game_id: prevGamesCounter,
              games_count: new BigNumber(1),
              total_won_amt: new BigNumber(0),
              total_lost_amt: new BigNumber(0)
            }
          );
        }
      )
    }
  );
});
