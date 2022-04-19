#include "../constants.ligo"
#include "../types.ligo"
#include "../utils.ligo"

[@inline] function get_expected_tez_amount(
  const asset           : asset_descriptor_t;
  const bid_size        : nat;
  const network_fee     : tez)
                        : tez is
  case asset of [
  | Tez(_) -> network_fee + bid_size * 1mutez
  | FA2(_) -> network_fee
  ];

function bet(
  const params          : bet_params_t;
  var storage           : storage_t)
                        : return_t is
  (no_operations, storage);

function reveal(
  const params          : reveal_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.server, Coinflip.not_server);
    require(List.length(params) > 0n, Coinflip.empty_list);
    var operations : list(operation) := no_operations;
    for single_reveal in list params {
      const game_id : nat = single_reveal.game_id;
      var game : game_t := unwrap_game(game_id, storage.games);
      var asset : asset_t := unwrap_asset(game.asset_id, storage.id_to_asset);
      const truncated_random = single_reveal.random_value mod max_random;
      const should_pay_reward = case game.bet_coin_side of [
      | Head(_) -> single_reveal.random_value < win_threshold
      | Tail(_) -> single_reveal.random_value >= win_threshold
      ];
      if should_pay_reward
        then block {
          game.status := Won;
          const payout_size = game.bid_size * asset.payout_quotient / precision;
          require(
            asset.bank + game.bid_size >= payout_size,
            Coinflip.cannot_pay
          );
          operations := transfer_asset(
            asset.descriptor,
            Tezos.self_address,
            game.gamer,
            payout_size
          ) # operations;
          asset.bank := abs(asset.bank + game.bid_size - payout_size);
        }
        else block {
          game.status := Lost;
          asset.bank := asset.bank + game.bid_size;
        };
      storage.games[game_id] := game;
      storage.id_to_asset[game.asset_id] := asset;
    }
  } with (operations, storage);
