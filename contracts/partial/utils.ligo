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
