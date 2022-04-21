type reveal_acc_t       is [@layout:comb] record [
  operations              : list(operation);
  games                   : big_map(nat, game_t);
  id_to_asset             : big_map(nat, asset_record_t);
]
