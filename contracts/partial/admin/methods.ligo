#include "../constants.ligo"
#include "../types.ligo"
#include "../utils.ligo"

function set_admin(
  const params          : address;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function set_server(
  const params          : address;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function set_payout_quotient(
  const params          : set_asset_value_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_payout(params.value);
    var asset : asset_t := unwrap_asset(params.asset_id, storage.id_to_asset);
    asset.payout_quotient := params.value;
    storage.id_to_asset[params.asset_id] := asset;
  } with (no_operations, storage);

function set_max_bet(
  const params          : set_asset_value_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_max_bet(params.value);
    var asset : asset_t := unwrap_asset(params.asset_id, storage.id_to_asset);
    asset.max_bet_percentage := params.value;
    storage.id_to_asset[params.asset_id] := asset;
  } with (no_operations, storage);

function set_network_fee(
  const new_fee         : tez;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    storage.network_fee := new_fee;
  } with (no_operations, storage);

function add_asset(
  const params          : add_asset_t;
  var storage           : storage_t)
                        : return_t is
  block {
    const asset : asset_descriptor_t = params.asset;
    require(Tezos.sender = storage.admin, Coinflip.not_admin);
    assert_valid_payout(params.payout_quotient);
    assert_valid_max_bet(params.max_bet_percentage);
    assert_valid_asset(asset, Coinflip.invalid_asset);

    const asset_key = Bytes.pack(asset);
    assert_none_with_error(
      storage.asset_to_id[asset_key],
      Coinflip.asset_exists
    );

    storage.asset_to_id[asset_key] := storage.assets_counter;
    storage.id_to_asset[storage.assets_counter] := record [
      descriptor         = asset;
      payout_quotient    = params.payout_quotient;
      bank               = 0n;
      max_bet_percentage = params.max_bet_percentage;
    ];
    storage.assets_counter := storage.assets_counter + 1n;
  } with (no_operations, storage);

function add_asset_bank(
  const params          : bank_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function remove_asset_bank(
  const params          : bank_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function withdraw_network_fee(
  const params          : nat;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);
