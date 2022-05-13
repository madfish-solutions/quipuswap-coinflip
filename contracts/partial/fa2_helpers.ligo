#include "../lib/i_fa2.ligo"
#include "./errors.ligo"
#include "./general_helpers.ligo"

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
