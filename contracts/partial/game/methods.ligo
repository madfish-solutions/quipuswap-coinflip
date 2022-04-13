#include "../constants.ligo"
#include "../types.ligo"
#include "../utils.ligo"

[@inline] function get_expected_tez_amount(
  const params          : bet_params_t;
  const storage         : storage_t)
                        : tez is
  case params.asset of [
  | Tez(_) -> storage.network_fee + params.bid_size * 1mutez
  | FA2(_) -> storage.network_fee
  ];

function bet(
  const params          : bet_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(params.bid_size > 0n, Coinflip.bid_too_low);
    var asset : asset_t := unwrap(
      find_asset(params.asset, storage),
      Coinflip.unknown_asset
    );
    const max_bid : nat = asset.bank * asset.max_bet_percentage / percent_precision;
    require(params.bid_size <= max_bid, Coinflip.bid_too_high);
    const expected_amount : tez = get_expected_tez_amount(params, storage);
    require(Tezos.amount = expected_amount, Coinflip.invalid_amount);

    storage.games[storage.games_counter] := record [
      asset            = params.asset;
      start            = Tezos.now;
      bid_size         = params.bid_size;
      bet_coin_side    = params.coin_side;
      result_coin_side = (None : option(coin_side_t))
    ];
    storage.games_counter := storage.games_counter + 1n;
    asset.bank := asset.bank + params.bid_size;
    storage.network_bank := storage.network_bank + storage.network_fee;

    const operations : list(operation) = case params.asset of [
    | Tez(_)     -> no_operations
    | FA2(token) -> list [
      transfer_fa2(
        Tezos.sender,
        Tezos.self_address,
        params.bid_size,
        token.address,
        token.id
      );
    ]
    ];
  } with (no_operations, storage);

function reveal(
  const params          : reveal_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);
