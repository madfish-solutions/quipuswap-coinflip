#include "../lib/i_fa2.ligo"
#include "./errors.ligo"
#include "./types.ligo"

[@inline] function require(
  const param           : bool;
  const error           : string)
                        : unit is 
  assert_with_error(param, error);

[@inline] function assert_sender(
  const expected        : address;
  const error           : string)
                        : unit is
  require(Tezos.sender = expected, error);

[@inline] function assert_admin(
  const storage         : storage_t)
                        : unit is
  assert_sender(storage.admin, Coinflip.not_admin);

[@inline] function assert_server(
  const storage         : storage_t)
                        : unit is
  assert_sender(storage.server, Coinflip.not_server);

[@inline] function unwrap(
  const param           : option(_a);
  const error           : string)
                        : _a is
  case param of [
    | Some(instance) -> instance
    | None -> failwith(error)
  ];

[@inline] function nat_or_error(
  const value           : int;
  const err             : string)
                        : nat is
  unwrap(is_nat(value), err);

function find_asset(
  const descriptor      : asset_descriptor_t;
  const storage         : storage_t)
                        : option(asset_t) is
  block {
    const asset_key = Bytes.pack(descriptor);
    const asset_id_opt : option(nat) = Big_map.find_opt(
      asset_key,
      storage.asset_to_id
    );
    const asset: option(asset_t) = case asset_id_opt of [
    | Some(asset_id) -> Big_map.find_opt(
      asset_id,
      storage.id_to_asset
    )
    | None           -> None
    ];
  } with asset;

function unwrap_asset_with_id(
  const descriptor      : asset_descriptor_t;
  const storage         : storage_t;
  const error           : string)
                        : asset_search_t is
  block {
    const asset_key = Bytes.pack(descriptor);
    const asset_id : nat = unwrap(
      Big_map.find_opt(asset_key, storage.asset_to_id),
      error
    );
    var asset : asset_t := unwrap(
      Big_map.find_opt(asset_id, storage.id_to_asset),
      error
    );
  } with record [ asset = asset; id = asset_id; ];

function get_opt_fa2_transfer_entrypoint(
  const token           : address)
                        : option(contract(fa2_transfer_type)) is
  Tezos.get_entrypoint_opt("%transfer", token);

function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_type) is
  case (get_opt_fa2_transfer_entrypoint(token)) of [
  | Some(contr) -> contr
  | None        -> (
    failwith("QSystem/fa2-transfer-entrypoint-404")
                        : contract(fa2_transfer_type)
  )
  ]

[@inline] function assert_valid_asset(
  const asset           : asset_descriptor_t;
  const error           : string)
                        : unit is
  block {
    case asset of [
    | FA2(token) -> assert_some_with_error(
      get_opt_fa2_transfer_entrypoint(token.address),
      error
    )
    | Tez(_)     -> skip
    ];
  } with unit;

function wrap_fa2_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const id              : nat)
                        : fa2_transfer_type is
  FA2_transfer_type(list [
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
  const asset           : asset_descriptor_t;
  const from_           : address;
  const to_             : address;
  const amt             : nat)
                        : operation is
  case asset of [
  | Tez(_) -> Tezos.transaction(
      unit,
      amt * 1mutez,
      unwrap(
        (Tezos.get_contract_opt(to_) : option(contract(unit))),
        Coinflip.no_such_account
      )
    )
  | FA2(token) -> transfer_fa2(from_, to_, amt, token.address, token.id)
  ]
