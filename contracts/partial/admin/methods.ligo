#include "../constants.ligo"
#include "../types.ligo"
#include "../coinflip_helpers.ligo"
#include "../fa2_helpers.ligo"
#include "../general_helpers.ligo"

function set_admin(
  const params          : address;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    storage.admin := params;
  } with (Constants.no_operations, storage);

function set_server(
  const params          : address;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    storage.server := params;
  } with (Constants.no_operations, storage);

function set_payout_quotient(
  const params          : set_asset_value_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_payout(params.value_f);
    var asset_record : asset_record_t := unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    asset_record.payout_quot_f := params.value_f;
    storage.id_to_asset[params.asset_id] := asset_record;
  } with (Constants.no_operations, storage);

function set_max_bet(
  const params          : set_asset_value_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_max_bet(params.value_f);
    var asset_record : asset_record_t := unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    asset_record.max_bet_percent_f := params.value_f;
    storage.id_to_asset[params.asset_id] := asset_record;
  } with (Constants.no_operations, storage);

function set_network_fee(
  const new_fee         : tez;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    storage.network_fee := new_fee;
  } with (Constants.no_operations, storage);

function add_asset(
  const params          : add_asset_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_payout(params.payout_quot_f);
    assert_valid_max_bet(params.max_bet_percent_f);
    const asset : asset_t = params.asset;

    const asset_key = Bytes.pack(asset);
    assert_none_with_error(
      storage.asset_to_id[asset_key],
      Coinflip.asset_exists
    );

    storage.asset_to_id[asset_key] := storage.assets_counter;
    storage.id_to_asset[storage.assets_counter] := record [
      asset             = asset;
      payout_quot_f     = params.payout_quot_f;
      bank              = 0n;
      max_bet_percent_f = params.max_bet_percent_f;
      total_won_amt     = 0n;
      total_lost_amt    = 0n;
      total_bets_amt    = 0n;
      games_count       = 0n;
      paused            = False;
    ];
    storage.assets_counter := storage.assets_counter + 1n;
  } with (Constants.no_operations, storage);

function add_asset_bank(
  const params          : bank_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    const amt : nat = params.amount;
    require(amt > 0n, Coinflip.zero_amount);
    var asset_record : asset_record_t := unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    var operations : list(operation) := Constants.no_operations;
    const asset : asset_t = asset_record.asset;
    case asset of [
    | Fa2(_) -> block {
      operations := list [
        transfer_asset(asset, Tezos.sender, Tezos.self_address, amt)
      ];
    }
    | Tez(_) -> require(Tezos.amount = amt * 1mutez, Coinflip.invalid_amount)
    ];

    asset_record.bank := asset_record.bank + amt;
    storage.id_to_asset[params.asset_id] := asset_record;
  } with (operations, storage);

function remove_asset_bank(
  const params          : bank_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    const amt : nat = params.amount;
    require(amt > 0n, Coinflip.zero_amount);
    var asset_record : asset_record_t := unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    asset_record.bank := nat_or_error(
      asset_record.bank - amt,
      Coinflip.amount_too_high
    );
    const operations = list [
      transfer_asset(asset_record.asset, Tezos.self_address, Tezos.sender, amt)
    ];

    storage.id_to_asset[params.asset_id] := asset_record;
  } with (operations, storage);

function withdraw_network_fee(
  const amt             : tez;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    require(amt > 0mutez, Coinflip.zero_amount);

    storage.network_bank := unwrap(
      storage.network_bank - amt,
      Coinflip.amount_too_high
    );
  } with (
    list [
      transfer_asset(Tez(unit), Tezos.self_address, Tezos.sender, amt / 1mutez)
    ],
    storage
  );

function set_paused(
  const params          : set_paused_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    var asset_record : asset_record_t := unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
    asset_record.paused := params.paused;
    storage.id_to_asset[params.asset_id] := asset_record;
  } with (Constants.no_operations, storage);
