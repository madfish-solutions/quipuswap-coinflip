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
  const params          : nat;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function set_max_bet(
  const params          : nat;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function set_network_fee(
  const params          : tez;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function add_asset(
  const params          : asset_descriptor_t;
  var storage           : storage_t)
                        : return_t is
  block {
    assert_admin(storage);
    assert_none_with_error(find_asset(params, storage), Coinflip.asset_exists);
    assert_valid_asset(params, Coinflip.invalid_asset);

    storage.asset_to_id[Bytes.pack(params)] := storage.assets_counter;
    storage.id_to_asset[storage.assets_counter] := record [
      descriptor         = params;
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
