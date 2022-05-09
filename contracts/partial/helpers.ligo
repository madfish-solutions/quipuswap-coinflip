#include "../lib/i_fa2.ligo"
#include "./errors.ligo"
#include "./types.ligo"

[@inline] function require(
  const param           : bool;
  const error           : string)
                        : unit is 
  assert_with_error(param, error);

[@inline] function unwrap<a> (
  const param           : option(a);
  const error           : string)
                        : a is
  case param of [
  | Some(instance) -> instance
  | None           -> failwith(error)
  ];

[@inline] function unwrap_or<a>(
  const param           : option(a);
  const default         : a)
                        : a is
  case param of [
  | Some(instance) -> instance
  | None           -> default
  ];

[@inline] function nat_or_error(
  const value           : int;
  const err             : string)
                        : nat is
  unwrap(is_nat(value), err);

[@inline] function unwrap_asset_record(
  const asset_id          : nat;
  const id_to_asset       : big_map(nat, asset_record_t))
                          : asset_record_t is
  unwrap(id_to_asset[asset_id], Coinflip.unknown_asset);

[@inline] function unwrap_game(
  const game_id         : nat;
  const games           : big_map(nat, game_t))
                        : game_t is
  unwrap(games[game_id], Coinflip.unknown_game);

[@inline] function assert_valid_payout(
  const value_f           : nat)
                          : unit is
  block {
    require(value_f > Constants.precision, Coinflip.payout_too_low);
    require(value_f <= Constants.max_payout_f, Coinflip.payout_too_high);
  } with unit;

[@inline] function assert_valid_max_bet(
  const value_f           : nat)
                          : unit is
  block {
    require(value_f > 0n, Coinflip.max_bet_too_low);
    require(value_f < Constants.precision, Coinflip.max_bet_exceed);
  } with unit;

function get_opt_fa2_transfer_entrypoint(
  const token           : address)
                        : option(contract(fa2_transfer_t)) is
  Tezos.get_entrypoint_opt("%transfer", token);

function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_t) is
  case (get_opt_fa2_transfer_entrypoint(token)) of [
  | Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa2-transfer-entrypoint-404")
                        : contract(fa2_transfer_t)
  )
  ]

function wrap_fa2_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const id              : nat)
                        : fa2_transfer_t is
  Fa2_transfer_type(list [
    record [
      from_ = from_;
      txs = list [
        record [
          to_ = to_;
          token_id = id;
          amount = amt;
        ]
      ]
    ]
  ])

function transfer_fa2(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : address;
  const id              : nat)
                        : operation is
  Tezos.transaction(
    wrap_fa2_transfer_trx(from_, to_, amt, id),
    0mutez,
    get_fa2_token_transfer_entrypoint(token)
  );

function transfer_asset(
  const asset           : asset_t;
  const from_           : address;
  const to_             : address;
  const amt             : nat)
                        : operation is
  case asset of [
  | Tez(_)     -> Tezos.transaction(
      unit,
      amt * 1mutez,
      unwrap(
        (Tezos.get_contract_opt(to_) : option(contract(unit))),
        Coinflip.no_such_account
      )
    )
  | Fa2(token) -> transfer_fa2(from_, to_, amt, token.address, token.id)
  ]
