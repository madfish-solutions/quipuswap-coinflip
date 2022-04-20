#include "../constants.ligo"
#include "../types.ligo"
#include "../helpers.ligo"

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
    require(params.bid_size > 0n, Coinflip.zero_amount);
    const asset_record : asset_record_t = unwrap_asset_record(
      params.asset_id,
      storage.id_to_asset
    );
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
    require(expected_tez_amount = Tezos.amount, Coinflip.invalid_amount);
    const operations : list(operation) = case asset of [
    | Tez(_)     -> Constants.no_operations
    | Fa2(token) -> list [
      transfer_fa2(
        Tezos.sender,
        Tezos.self_address,
        params.bid_size,
        token.address,
        token.id
      )
    ]
    ];
    storage.games[storage.games_counter] := record [
      asset_id      = params.asset_id;
      gamer         = Tezos.sender;
      start         = Tezos.now;
      bid_size      = params.bid_size;
      bet_coin_side = params.coin_side;
      status        = Started;
    ];
    storage.games_counter := storage.games_counter + 1n;
    storage.network_bank := storage.network_bank + storage.network_fee;
  } with (operations, storage);

type reveal_acc_t       is [@layout:comb] record [
  operations              : list(operation);
  games                   : big_map(nat, game_t);
  id_to_asset             : big_map(nat, asset_record_t);
]

function reveal(
  const params          : reveal_params_t;
  var storage           : storage_t)
                        : return_t is
  block {
    require(Tezos.sender = storage.server, Coinflip.not_server);
    require(List.length(params) > 0n, Coinflip.empty_list);

    function process_reveals(
      const acc         : reveal_acc_t;
      const one_reveal  : one_reveal_t)
                        : reveal_acc_t is
      block {
        var new_operations := acc.operations;
        var new_games := acc.games;
        var new_id_to_asset := acc.id_to_asset;
        const game_id = one_reveal.game_id;
        var game := unwrap_game(game_id, new_games);
        require(game.status = Started, Coinflip.game_finished);
        var asset_record : asset_record_t := unwrap_asset_record(
          game.asset_id,
          acc.id_to_asset
        );
        const truncated_random = one_reveal.random_value mod
          Constants.max_random;
        const should_pay_reward = case game.bet_coin_side of [
        | Head(_) -> truncated_random < Constants.win_threshold
        | Tail(_) -> truncated_random >= Constants.win_threshold
        ];
        if should_pay_reward
        then block {
          game.status := Won;
          const payout_size = game.bid_size * asset_record.payout_quot_f
            / Constants.precision;
          require(
            asset_record.bank + game.bid_size >= payout_size,
            Coinflip.cannot_pay
          );
          new_operations := transfer_asset(
            asset_record.asset,
            Tezos.self_address,
            game.gamer,
            payout_size
          ) # acc.operations;
          asset_record.bank := abs(
            asset_record.bank + game.bid_size - payout_size
          );
        }
        else block {
          game.status := Lost;
          asset_record.bank := asset_record.bank + game.bid_size;
        };
        new_games[game_id] := game;
        new_id_to_asset[game.asset_id] := asset_record;
      } with record [
        operations  = new_operations;
        games       = new_games;
        id_to_asset = new_id_to_asset
      ];

    const reveal_results : reveal_acc_t = List.fold(
      process_reveals,
      params,
      record [
        operations  = Constants.no_operations;
        games       = storage.games;
        id_to_asset = storage.id_to_asset
      ]
    );
    storage.games := reveal_results.games;
    storage.id_to_asset := reveal_results.id_to_asset;
  } with (reveal_results.operations, storage);
