#include "../partial/proxy/types.ligo"
#include "../partial/proxy/methods.ligo"

function main(
  const action          : actions_t;
  const s               : storage_t)
                        : return_t is
  case action of [
  | Proxy_bet(params) -> proxy_bet(params, s)
  ];
