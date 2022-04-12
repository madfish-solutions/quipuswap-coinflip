const precision         : nat = 1_000_000_000_000_000_000n; (* 1e18 The precision to convert to *)
const percent_precision : nat = 10_000_000_000_000_000n;    (* 1e16 Percentage precision *)

[@inline] const no_operations   : list(operation) = nil;
[@inline] const max_random      : nat = 100n;
[@inline] const win_threshold   : nat = 50n;
[@inline] const default_max_bet : nat = 50n * percent_precision;
[@inline] const default_payout  : nat = precision * 3n / 2n;
