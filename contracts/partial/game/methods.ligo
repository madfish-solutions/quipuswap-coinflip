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
  block {
    require(params.bid_size > 0n, Coinflip.zero_amount);
    const asset : asset_t = unwrap_asset(params.asset_id, storage.id_to_asset);
    require(
      params.bid_size <= asset.max_bet_percentage * asset.bank / precision,
      Coinflip.bid_too_high
    );
    const expected_tez_amount : tez = get_expected_tez_amount(
      asset.descriptor,
      params.bid_size,
      storage.network_fee
    );
    require(expected_tez_amount = Tezos.amount, Coinflip.invalid_amount);
    const operations : list(operation) = case asset.descriptor of [
    | Tez(_)     -> no_operations
    | FA2(token) -> list [
      transfer_fa2(
        Tezos.sender,
        Tezos.self_address,
        params.bid_size,
        token.address,
        token.id
      )
    ]
    ];
    storage.games[storage.games_counter] := record [
      asset         = asset.descriptor;
      start         = Tezos.now;
      bid_size      = params.bid_size;
      bet_coin_side = params.coin_side;
      status        = Started;
    ];
    storage.games_counter := storage.games_counter + 1n;
    storage.network_bank := storage.network_bank + storage.network_fee;
  } with (operations, storage);

function reveal(
  const params          : reveal_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);
