module Coinflip is {
  const bid_too_high    : string = "Coinflip/bid-too-high";
  const not_admin       : string = "Coinflip/not-admin";
  const not_server      : string = "Coinflip/not-server";
  const game_not_found  : string = "Coinflip/game-not-found";
  const game_ended      : string = "Coinflip/game-ended";
  const unknown_asset   : string = "Coinflip/unknown-asset";
  const asset_exists    : string = "Coinflip/asset-exists";
  const invalid_amount  : string = "Coinflip/invalid-amount";
  const zero_amount     : string = "Coinflip/zero-amount";
  const no_such_account : string = "Coinflip/no-such-account";
  const payout_too_low  : string = "Coinflip/payout-too-low";
  const payout_too_high : string = "Coinflip/payout-too-high";
  const max_bet_too_low : string = "Coinflip/max-bet-too-low";
  const max_bet_exceed  : string = "Coinflip/max-bet-exceed";
  const amount_too_high : string = "Coinflip/amount-too-high";
  const empty_list      : string = "Coinflip/empty-list";
  const unknown_game    : string = "Coinflip/unknown-game";
  const cannot_pay      : string = "Coinflip/cannot-pay";
  const game_finished   : string = "Coinflip/game-finished";
  const asset_paused    : string = "Coinflip/asset-paused";
  const indirect_bet    : string = "Coinflip/indirect-bet";
}

module Bet_proxy is {
  const not_gambling    : string = "Bet_proxy/not-gambling";
}
