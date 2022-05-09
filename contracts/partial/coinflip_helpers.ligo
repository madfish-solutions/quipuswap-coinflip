#include "./errors.ligo"
#include "./types.ligo"
#include "./general_helpers.ligo"

[@inline] function unwrap_asset_record(
  const asset_id          : nat;
  const id_to_asset       : big_map(nat, asset_record_t))
                          : asset_record_t is
  unwrap(id_to_asset[asset_id], Coinflip.unknown_asset);

[@inline] function unwrap_game(
  const game_id         : nat;
  const games           : big_map(nat, game_t))
                        : game_t is
  unwrap(games[game_id], Coinflip.unknown_game);

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
