import BigNumber from 'bignumber.js';

import defaultStorage from '../storage/coinflip';

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
