type token_id_t      is nat (* Token ID *)

type transfer_dst_type  is [@layout:comb] record [
  (* Recipient of tokens *)
  to_                     : address;
  (* Token ID *)
  token_id                : token_id_t;
  (* Number of tokens to transfer *)
  amount                  : nat;
]

type fa2_send_type      is [@layout:comb] record [
  (* Sender of tokens *)
  from_                   : address;
  (* Transactions *)
  txs                     : list(transfer_dst_type);
]

type fa2_transfer_type  is
FA2_transfer_type         of list(fa2_send_type) (* Transfers list *)
