#include "../partial/admin/methods.ligo"
#include "../partial/game/methods.ligo"
#include "../partial/types.ligo"

function main(
  const action          : actions_t;
  const s               : storage_t)
                        : return_t is
  case action of [
    | Bet(params)                  -> bet(params, s)
    | Reveal(params)               -> reveal(params, s)
    | Set_admin(params)            -> set_admin(params, s)
    | Set_server(params)           -> set_server(params, s)
    | Set_payout_quotient(params)  -> set_payout_quotient(params, s)
    | Set_max_bet(params)          -> set_max_bet(params, s)
    | Set_network_fee(params)      -> set_network_fee(params, s)
    | Add_asset(params)            -> add_asset(params, s)
    | Add_asset_bank(params)       -> add_asset_bank(params, s)
    | Remove_asset_bank(params)    -> remove_asset_bank(params, s)
    | Withdraw_network_fee(params) -> withdraw_network_fee(params, s)
  ];
