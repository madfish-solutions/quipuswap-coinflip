import { Schema } from '@taquito/michelson-encoder';

export const gamerStatsSchema = new Schema({
  prim: "pair",
  args: [
    { prim: "nat", annots: ["%last_game_id"] },
    { prim: "nat", annots: ["%games_count"] },
    { prim: "nat", annots: ["%total_won_amt"] },
    { prim: "nat", annots: ["%total_lost_amt"] },
    { prim: "nat", annots: ["%total_bets_amt"] }
  ]
});
