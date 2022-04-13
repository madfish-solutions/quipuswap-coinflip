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
    assert_admin(storage);
    require(params.value > precision, Coinflip.payout_too_low);
    var search_result : asset_search_t := unwrap_asset_with_id(
      params.asset,
      storage,
      Coinflip.unknown_asset
    );
    var asset : asset_t := search_result.asset;
    patch asset with record [
      payout_quotient = params.value;
    ];
    storage.id_to_asset[search_result.id] := asset;
  } with (no_operations, storage);

function set_max_bet(
  const params          : set_asset_value_t;
  var storage           : storage_t)
                        : return_t is
  block {
    assert_admin(storage);
    var search_result : asset_search_t := unwrap_asset_with_id(
      params.asset,
      storage,
      Coinflip.unknown_asset
    );
    var asset : asset_t := search_result.asset;
    const max_bet_percentage : nat = precision * precision
      / abs(asset.payout_quotient - precision);
    require(params.value <= max_bet_percentage, Coinflip.max_bet_exceed);
    patch asset with record [
      max_bet_percentage = params.value;
    ];
    storage.id_to_asset[search_result.id] := asset;
  } with (no_operations, storage);

function set_network_fee(
  const new_fee         : tez;
  var storage           : storage_t)
                        : return_t is
  block {
    assert_admin(storage);
    require(new_fee >= min_network_fee, Coinflip.net_fee_too_low);
    storage.network_fee := new_fee;
  } with (no_operations, storage);

function add_asset(
  const params          : add_asset_t;
  var storage           : storage_t)
                        : return_t is
  block {
    const asset : asset_descriptor_t = params.value;
    assert_admin(storage);
    assert_none_with_error(find_asset(asset, storage), Coinflip.asset_exists);
    assert_valid_asset(asset, Coinflip.invalid_asset);

    storage.asset_to_id[Bytes.pack(asset)] := storage.assets_counter;
    storage.id_to_asset[storage.assets_counter] := record [
      descriptor         = asset;
      payout_quotient    = default_payout;
      bank               = 0n;
      max_bet_percentage = default_max_bet;
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
