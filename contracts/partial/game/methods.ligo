#include "../constants.ligo"
#include "../types.ligo"
#include "../utils.ligo"

(*function start_game(
  const params          : start_game_t;
  const storage         : storage_t)
                        : return_t is
  block {
    require(params.bet > 0n, Lottery.zero_amount_in);
    require(Tezos.amount >= storage.gas_comission, Lottery.not_enough_fee);
    storage.games[storage.games_count] := record [
      start               = Tezos.now;
      bet                 = params.bet;
      state               = Pending;
    ];
    storage.games_count := storage.games_count + 1n;

    const operations: list(operation) = list [
      Tezos.transaction(unit, Tezos.amount, Tezos.implicit_account(storage.oracle))
    ];
  } with (operations, storage)

function end_game(
  const params          : end_game_t;
  const storage         : storage_t)
                        : return_t is
  block {
    assert_oracle(storage.oracle);
    require(params.random <= max_random, Lottery.random_too_high);
    const opt_game: option(game_t) = Big_map.find_opt(params.game_id, storage.games);
    var game := unwrap(opt_game, Lottery.game_not_found);
    require(game.state = Pending, Lottery.game_ended);
    game.state := if params.random < storage.win_percentage then Won else Lost;

    const operations: list(operation) = no_operations;
  } with (operations, storage) *)

function bet(
  const params          : bet_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);

function reveal(
  const params          : reveal_params_t;
  const storage         : storage_t)
                        : return_t is
  (no_operations, storage);
