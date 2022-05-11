import { MichelsonMap } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { getAssetKey } from '../utils/byte-keys';

const TEZ_ASSET = { tez: Symbol() };
const QUIPU_ASSET = {
  fa2: {
    address: process.env.QUIPU_TOKEN_ADDRESS,
    id: new BigNumber(process.env.QUIPU_TOKEN_ID)
  }
};

export default {
  admin: process.env.ADMIN_ADDRESS,
  server: process.env.SERVER_ADDRESS,
  games_counter: 0,
  games: MichelsonMap.fromLiteral({}),
  assets_counter: 2,
  network_fee: 10000,
  asset_to_id: MichelsonMap.fromLiteral({
    [getAssetKey(TEZ_ASSET)]: 0,
    [getAssetKey(QUIPU_ASSET)]: 1
  }),
  id_to_asset: MichelsonMap.fromLiteral({
    0: {
      asset: TEZ_ASSET,
      payout_quot_f: new BigNumber(1.8e18),
      bank: 0,
      max_bet_percent_f: new BigNumber(5e17),
      total_won_amt: 0,
      total_lost_amt: 0,
      total_bets_amt: 0,
      games_count: 0,
      paused: false
    },
    1: {
      asset: QUIPU_ASSET,
      payout_quot_f: new BigNumber(1.8e18),
      bank: 0,
      max_bet_percent_f: new BigNumber(5e17),
      total_won_amt: 0,
      total_lost_amt: 0,
      total_bets_amt: 0,
      games_count: 0,
      paused: false
    }
  }),
  gamers_stats: MichelsonMap.fromLiteral({}),
  network_bank: 0
};
