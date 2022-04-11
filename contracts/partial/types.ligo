type coin_side_t        is
| Head                    of unit
| Tail                    of unit

type token_id_t         is nat

type fa2_token_t        is record [
  token_address           : address;
  token_id                : token_id_t;
]

type asset_descriptor_t is
| Tez                     of unit
| FA2                     of fa2_token_t

type asset_t            is [@layout:comb] record [
  descriptor              : asset_descriptor_t;
  payout_quotient         : nat;
  bank                    : nat;
]

type game_t             is [@layout:comb] record [
  asset                   : asset_descriptor_t;
  start                   : timestamp;
  bid_size                : nat;
  bet_coin_side           : coin_side_t;
  result_coin_side        : option(coin_side_t);
]

type storage_t          is [@layout:comb] record [
	admin                   : address;
	server                  : address;
	games_counter           : nat;
  games                   : big_map(nat, game_t);
  assets_counter          : nat;
  network_fee             : tez;
  asset_to_id             : big_map(bytes, nat);
  id_to_asset             : big_map(nat, asset_t);
  network_bank            : nat;
]

type return_t           is list(operation) * storage_t

type bet_params_t       is record [
  asset                   : asset_descriptor_t;
  bid_size                : nat;
  coin_side               : coin_side_t;
]

type one_reveal_t       is record [
  game_id                 : nat;
  random_value            : nat;
]

type reveal_params_t    is list(one_reveal_t)

type bank_params_t      is record [
  asset                   : asset_t;
  amount                  : option(nat);
]

type actions_t          is
| Bet                     of bet_params_t
| Reveal                  of reveal_params_t
| Set_admin               of address
| Set_server              of address
| Set_payout_quotient     of nat
| Set_max_bet             of nat
| Set_network_fee         of tez
| Add_asset               of fa2_token_t
| Add_asset_bank          of bank_params_t
| Remove_asset_bank       of bank_params_t
| Withdraw_network_fee    of nat
