#include "./types.ligo"

module Constants is {
  [@inline] const precision       : nat = 1_000_000_000_000_000_000n; (* 1e18 The precision to convert to *)
  [@inline] const no_operations   : list(operation) = nil;
  [@inline] const max_random      : nat = 58n;
  [@inline] const win_threshold   : nat = 29n;
  [@inline] const max_payout_f    : nat = 2n * precision;
  [@inline] const ini_gamer_stats : gamer_stats_t = record [
    last_game_id   = 0n;
    games_count    = 0n;
    total_won_amt  = 0n;
    total_lost_amt = 0n;
    total_bets_amt = 0n;
  ];
}
