#include "../constants.ligo"
#include "../types.ligo"
#include "../helpers.ligo"

[@inline] function get_expected_tez_amount(
  const params          : bet_params_t;
  const storage         : storage_t)
                        : tez is
  case params.asset of [
  | Tez(_) -> storage.network_fee + params.bid_size * 1mutez
  | Fa2(_) -> storage.network_fee
  ];

function bet(
  const params          : bet_params_t;
  var storage           : storage_t)
                        : return_t is
   (no_operations, storage);

function reveal(
  const params          : reveal_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);
