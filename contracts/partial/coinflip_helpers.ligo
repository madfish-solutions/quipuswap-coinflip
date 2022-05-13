#include "./errors.ligo"
#include "./types.ligo"
#include "./general_helpers.ligo"

[@inline] function assert_valid_payout(
  const value_f           : nat)
                          : unit is
  block {
    require(value_f > Constants.precision, Coinflip.payout_too_low);
    require(value_f <= Constants.max_payout_f, Coinflip.payout_too_high);
  } with unit;

[@inline] function assert_valid_max_bet(
  const value_f           : nat)
                          : unit is
  block {
    require(value_f > 0n, Coinflip.max_bet_too_low);
    require(value_f < Constants.precision, Coinflip.max_bet_exceed);
  } with unit;
