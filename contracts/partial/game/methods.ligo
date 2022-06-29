#include "../constants.ligo"
#include "../errors.ligo"
#include "../coinflip_helpers.ligo"
#include "../fa2_helpers.ligo"
#include "../general_helpers.ligo"
#include "../types.ligo"
#include "./types.ligo"

[@inline] function get_expected_tez_amount(
  const asset           : asset_t;
  const bid_size        : nat;
  const network_fee     : tez)
                        : tez is
  case asset of [
  | Tez(_) -> network_fee + bid_size * 1mutez
  | Fa2(_) -> network_fee
  ];

function bet(
  const params          : bet_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.get_sender() = Tezos.get_source(), Coinflip.indirect_bet);
    require(params.bid_size > 0n, Coinflip.zero_amount);
    var asset_record := unwrap(
      storage.id_to_asset[params.asset_id],
      Coinflip.unknown_asset
    );
    require(not asset_record.paused, Coinflip.asset_paused);
    require(
      params.bid_size <= asset_record.max_bet_percent_f * asset_record.bank
        / Constants.precision,
      Coinflip.bid_too_high
    );
    const asset : asset_t = asset_record.asset;
    const expected_tez_amount : tez = get_expected_tez_amount(
      asset,
      params.bid_size,
      storage.network_fee
    );
    require(expected_tez_amount = Tezos.get_amount(), Coinflip.invalid_amount);
    const operations : list(operation) = case asset of [
    | Tez(_)     -> Constants.no_operations
    | Fa2(token) -> list [
      transfer_fa2(
        Tezos.get_sender(),
        Tezos.get_self_address(),
        params.bid_size,
        token.address,
        token.id
      )
    ]
    ];
    storage.games[storage.games_counter] := record [
      asset_id      = params.asset_id;
      gamer         = Tezos.get_sender();
      start         = Tezos.get_now();
      bid_size      = params.bid_size;
      bet_coin_side = params.coin_side;
      status        = Started;
    ];
    asset_record := asset_record with record [
      games_count    += 1n;
      total_bets_amt += params.bid_size;
    ];
    storage.id_to_asset[params.asset_id] := asset_record;
    const gamer_stats_key = (Tezos.get_sender(), params.asset_id);
    var new_gamer_stats : gamer_stats_t := unwrap_or(
      storage.gamers_stats[gamer_stats_key],
      Constants.ini_gamer_stats
    ) with record [
      last_game_id    = storage.games_counter;
      total_bets_amt += params.bid_size;
      games_count    += 1n;
    ];
    storage.gamers_stats[gamer_stats_key] := new_gamer_stats;
    storage.games_counter := storage.games_counter + 1n;
    storage.network_bank := storage.network_bank + storage.network_fee;
  } with (operations, storage);

function reveal(
  const params          : reveal_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.get_sender() = storage.server, Coinflip.not_server);
    require(List.length(params) > 0n, Coinflip.empty_list);

    function process_reveals(
      const acc         : reveal_acc_t;
      const one_reveal  : one_reveal_t)
                        : reveal_acc_t is
      block {
        const game_id = one_reveal.game_id;
        var new_games := acc.games;
        var game := unwrap(new_games[game_id], Coinflip.unknown_game);
        require(game.status = Started, Coinflip.game_finished);
        var asset_record := unwrap(
          acc.id_to_asset[game.asset_id],
          Coinflip.unknown_asset
        );
        var new_operations := acc.operations;
        var new_id_to_asset := acc.id_to_asset;
        var new_gamers_stats := acc.gamers_stats;
        const truncated_random = one_reveal.random_value mod
          Constants.max_random;
        const gamer_stats_key = (game.gamer, game.asset_id);
        var new_gamer_stats : gamer_stats_t := unwrap_or(
          new_gamers_stats[gamer_stats_key],
          Constants.ini_gamer_stats
        );
        const should_pay_reward = case game.bet_coin_side of [
        | Head(_) -> truncated_random < Constants.win_threshold
        | Tail(_) -> truncated_random >= Constants.win_threshold
        ];
        if should_pay_reward
        then {
          game.status := Won;
          const payout_size = game.bid_size * asset_record.payout_quot_f
            / Constants.precision;
          asset_record.bank := nat_or_error(
            asset_record.bank + game.bid_size - payout_size,
            Coinflip.cannot_pay
          );
          new_gamer_stats.total_won_amt := new_gamer_stats.total_won_amt +
            payout_size;
          new_operations := transfer_asset(
            asset_record.asset,
            Tezos.get_self_address(),
            game.gamer,
            payout_size
          ) # acc.operations;
          asset_record.total_won_amt := asset_record.total_won_amt
            + payout_size;
        }
        else {
          game.status := Lost;
          asset_record.bank := asset_record.bank + game.bid_size;
          asset_record.total_lost_amt :=
            asset_record.total_lost_amt + game.bid_size;
          new_gamer_stats.total_lost_amt := new_gamer_stats.total_lost_amt +
            game.bid_size;
        };
        new_games[game_id] := game;
        new_id_to_asset[game.asset_id] := asset_record;
        new_gamers_stats[gamer_stats_key] := new_gamer_stats;
      } with record [
        operations   = new_operations;
        games        = new_games;
        id_to_asset  = new_id_to_asset;
        gamers_stats = new_gamers_stats;
      ];

    const reveal_results : reveal_acc_t = List.fold(
      process_reveals,
      params,
      record [
        operations   = Constants.no_operations;
        games        = storage.games;
        id_to_asset  = storage.id_to_asset;
        gamers_stats = storage.gamers_stats;
      ]
    );
    storage.games := reveal_results.games;
    storage.id_to_asset := reveal_results.id_to_asset;
    storage.gamers_stats := reveal_results.gamers_stats;
  } with (reveal_results.operations, storage);
