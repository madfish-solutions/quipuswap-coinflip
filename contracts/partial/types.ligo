type coin_side_t        is
| Head                    of unit
| Tail                    of unit

type token_id_t         is nat

type fa2_token_t        is [@layout:comb] record [
  address                 : address;
  id                      : token_id_t;
]

type asset_descriptor_t is
| Tez                     of unit
| FA2                     of fa2_token_t

type asset_t            is [@layout:comb] record [
  descriptor              : asset_descriptor_t;
  payout_quotient         : nat;
  bank                    : nat;
  max_bet_percentage      : nat;
]

type game_status_t      is
| Started                 of unit
| Won                     of unit
| Lost                    of unit

type game_t             is [@layout:comb] record [
  asset                   : asset_descriptor_t;
  start                   : timestamp;
  bid_size                : nat;
  bet_coin_side           : coin_side_t;
  status                  : game_status_t;
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
  network_bank            : tez;
]

type return_t           is list(operation) * storage_t

type bet_params_t       is [@layout:comb] record [
  asset_id                : nat;
  bid_size                : nat;
  coin_side               : coin_side_t;
]

type one_reveal_t       is [@layout:comb] record [
  game_id                 : nat;
  random_value            : nat;
]

type reveal_params_t    is list(one_reveal_t)

type bank_params_t      is [@layout:comb] record [
  amount                  : nat;
  asset_id                : nat;
]

type set_asset_value_t  is [@layout:comb] record [
  value                   : nat;
  asset_id                : nat;
]

type add_asset_t        is [@layout:comb] record [
  payout_quotient         : nat;
  max_bet_percentage      : nat;
  asset                   : asset_descriptor_t;
]

type actions_t          is
| Bet                     of bet_params_t
| Reveal                  of reveal_params_t
| Set_admin               of address
| Set_server              of address
| Set_payout_quotient     of set_asset_value_t
| Set_max_bet             of set_asset_value_t
| Set_network_fee         of tez
| Add_asset               of add_asset_t
| Add_asset_bank          of bank_params_t
| Remove_asset_bank       of bank_params_t
| Withdraw_network_fee    of tez
#if TEST
| Do                      of unit
#else
#endif
