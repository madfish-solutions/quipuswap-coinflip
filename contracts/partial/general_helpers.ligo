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

[@inline] function nat_or_error(
  const value           : int;
  const err             : string)
                        : nat is
  unwrap(is_nat(value), err);

[@inline] function unwrap_or<a>(
  const param           : option(a);
  const default         : a)
                        : a is
  case param of [
  | Some(instance) -> instance
  | None           -> default
  ];
