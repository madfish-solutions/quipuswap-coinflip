type storage_t          is [@layout:comb] record [
  gamble_address          : address;
  r                       : unit;
]

type return_t           is list(operation) * storage_t

type coin_side_t        is
| Head                    of unit
| Tail                    of unit

type bet_params_t       is [@layout:comb] record [
  asset_id                : nat;
  bid_size                : nat;
  coin_side               : coin_side_t;
]

type actions_t is
| Proxy_bet               of bet_params_t

type bet_actions_t is
| Bet                     of bet_params_t
