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
  const params          : fa2_token_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

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
