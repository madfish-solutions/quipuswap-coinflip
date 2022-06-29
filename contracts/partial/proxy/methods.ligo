#include "../errors.ligo"
#include "../general_helpers.ligo"
#include "./types.ligo"

function proxy_bet(
  const params          : bet_params_t;
  const storage         : storage_t)
                        : return_t is
  block {
    const gamble_contract_opt : option(contract(bet_actions_t)) =
      Tezos.get_entrypoint_opt("%bet", storage.gamble_address);
    const gamble_contract = unwrap(gamble_contract_opt, Bet_proxy.not_gambling);
  } with (list [
    Tezos.transaction(Bet(params), Tezos.get_amount(), gamble_contract)
  ], storage);
