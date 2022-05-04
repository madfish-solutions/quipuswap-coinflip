import BigNumber from 'bignumber.js';
import { alice, bob, carol } from '../scripts/sandbox/accounts';

import defaultStorage from './storage/coinflip';
import { Game } from './coinflip';

// Some contract constants
export const PRECISION = new BigNumber('1e18');
export const PERCENT_PRECISION = new BigNumber(1e16);

// Tests configuration values
export const defaultPayout = PRECISION.times(1.5);
export const defaultMaxBetPercentage = PERCENT_PRECISION.times(50);
export const defaultNetworkFee = defaultStorage.network_fee;
export const testNetworkBank = 2000;
export const testTezBank = 5000;
export const testFa2TokenBank = 1000;

// Reducing amount of code in tests
export const testMaxFA2Bet = 500;
export const testMaxTezBet = 2500;

export const nonExistentFA2Asset = {
  fa2: {
    address: 'KT1HrQWkSFe7ugihjoMWwQ7p8ja9e18LdUFn',
    id: new BigNumber(0)
  }
};
export const defaultFA2TokenId = 0;
export const tezAssetId = '0';
export const defaultFA2AssetId = '1';
export const defaultUnknownAssetId = '2';

export const testGames: Game[] = [
  // finished games
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T00:19:00.000Z',
    bid_size: new BigNumber(150),
    bet_coin_side: { head: Symbol() },
    status: { won: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T01:19:00.000Z',
    bid_size: new BigNumber(150),
    bet_coin_side: { tail: Symbol() },
    status: { lost: Symbol() }
  },
  // testcase "Should make a game with bet for 'head' coin side won if random_value % 100 < 50"
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T02:19:00.000Z',
    bid_size: new BigNumber(150),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: bob.pkh,
    start: '2022-04-19T03:19:00.000Z',
    bid_size: new BigNumber(160),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: carol.pkh,
    start: '2022-04-19T04:19:00.000Z',
    bid_size: new BigNumber(170),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: alice.pkh,
    start: '2022-04-19T05:19:00.000Z',
    bid_size: new BigNumber(180),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  // testcase "Should make a game with bet for 'tail' coin side won if random_value % 100 >= 50"
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: alice.pkh,
    start: '2022-04-19T06:19:00.000Z',
    bid_size: new BigNumber(110),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: bob.pkh,
    start: '2022-04-19T07:19:00.000Z',
    bid_size: new BigNumber(120),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: carol.pkh,
    start: '2022-04-19T08:19:00.000Z',
    bid_size: new BigNumber(130),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T09:19:00.000Z',
    bid_size: new BigNumber(140),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  // testcase "Should make a game with bet for 'head' coin side lost if random_value % 100 >= 50"
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T10:19:00.000Z',
    bid_size: new BigNumber(150),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: bob.pkh,
    start: '2022-04-19T11:19:00.000Z',
    bid_size: new BigNumber(160),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: carol.pkh,
    start: '2022-04-19T12:19:00.000Z',
    bid_size: new BigNumber(170),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: alice.pkh,
    start: '2022-04-19T13:19:00.000Z',
    bid_size: new BigNumber(180),
    bet_coin_side: { head: Symbol() },
    status: { started: Symbol() }
  },
  // testcase "Should make a game with bet for 'tail' coin side lost if random_value % 100 < 50"
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: alice.pkh,
    start: '2022-04-19T14:19:00.000Z',
    bid_size: new BigNumber(110),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: bob.pkh,
    start: '2022-04-19T15:19:00.000Z',
    bid_size: new BigNumber(120),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(defaultFA2AssetId),
    gamer: carol.pkh,
    start: '2022-04-19T16:19:00.000Z',
    bid_size: new BigNumber(130),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  },
  {
    asset_id: new BigNumber(tezAssetId),
    gamer: alice.pkh,
    start: '2022-04-19T17:19:00.000Z',
    bid_size: new BigNumber(140),
    bet_coin_side: { tail: Symbol() },
    status: { started: Symbol() }
  }
];
