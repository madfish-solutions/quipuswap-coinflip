import { MichelsonMap } from '@taquito/taquito';
import BigNumber from 'bignumber.js';
import { AssetRecord } from '../tests/coinflip';
import { michelsonMapFromEntries } from '../utils/helpers';

import { assetSchema, assetRecordSchema } from '../utils/schemas';

const TEZ_ASSET = { tez: Symbol() };
const QUIPU_ASSET = {
  fa2: {
    address: process.env.QUIPU_TOKEN_ADDRESS,
    id: new BigNumber(process.env.QUIPU_TOKEN_ID)
  }
};

const assetRecords: AssetRecord[] = [
  {
    asset: TEZ_ASSET,
    payout_quot_f: new BigNumber(1.8e18),
    bank: new BigNumber(0),
    max_bet_percent_f: new BigNumber(5e17),
    total_won_amt: new BigNumber(0),
    total_lost_amt: new BigNumber(0),
    total_bets_amt: new BigNumber(0),
    games_count: new BigNumber(0),
    paused: false
  },
  {
    asset: QUIPU_ASSET,
    payout_quot_f: new BigNumber(1.8e18),
    bank: new BigNumber(0),
    max_bet_percent_f: new BigNumber(5e17),
    total_won_amt: new BigNumber(0),
    total_lost_amt: new BigNumber(0),
    total_bets_amt: new BigNumber(0),
    games_count: new BigNumber(0),
    paused: false
  }
];

export default {
  admin: process.env.ADMIN_ADDRESS,
  server: process.env.SERVER_ADDRESS,
  games_counter: 0,
  games: MichelsonMap.fromLiteral({}),
  assets_counter: assetRecords.length,
  network_fee: 10000,
  asset_to_id: michelsonMapFromEntries(
    [...assetRecords.entries()].map(
      ([index, { asset }]) => [asset, index]
    ),
    { prim: "map", args: [assetSchema.val, { prim: "nat" }] }
  ),
  id_to_asset: michelsonMapFromEntries(
    [...assetRecords.entries()],
    { prim: "map", args: [{ prim: "nat" }, assetRecordSchema.val] }
  ),
  gamers_stats: MichelsonMap.fromLiteral({}),
  network_bank: 0
};
