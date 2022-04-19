#include "../constants.ligo"
#include "../types.ligo"
#include "../helpers.ligo"

[@inline] function get_expected_tez_amount(
  const asset           : asset_t;
  const bid_size        : nat;
  const network_fee     : tez)
                        : tez is
  case asset of [
  | Tez(_) -> network_fee + bid_size * 1mutez
  | Fa2(_) -> network_fee
  ];

function bet(
  const params          : bet_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(params.bid_size > 0n, Coinflip.zero_amount);
    const asset_record : asset_record_t = unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    require(
      params.bid_size <= asset_record.max_bet_percent_f * asset_record.bank
        / Constants.precision,
      Coinflip.bid_too_high
    );
    const asset : asset_t = asset_record.asset;
    const expected_tez_amount : tez = get_expected_tez_amount(
      asset,
      params.bid_size,
      storage.network_fee
    );
    require(expected_tez_amount = Tezos.amount, Coinflip.invalid_amount);
    const operations : list(operation) = case asset of [
    | Tez(_)     -> Constants.no_operations
    | Fa2(token) -> list [
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
      asset         = asset;
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
  (Constants.no_operations, storage);
