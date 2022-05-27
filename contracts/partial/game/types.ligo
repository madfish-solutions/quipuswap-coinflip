type reveal_acc_t       is [@layout:comb] record [
  operations              : list(operation);
  games                   : big_map(nat, game_t);
  id_to_asset             : big_map(nat, asset_record_t);
  gamers_stats            : big_map(address * nat, gamer_stats_t);
]
