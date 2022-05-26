# Quipuswap Coinflip

##### Currently work in progress

A smart contract which implements gambling process from 'Game' Quipuswap page.

# Description
Edit for yourself:
- package.json
- /tests/
- /contracts
- /migrations
- /storage

```
./storage - prod storage
./tests/storage - dev storage

```

# Requirements

- Installed NodeJS (tested with NodeJS v14+)
- Installed Yarn

- Installed node modules:

```
yarn install

```

# Quick Start tests

```
yarn start-sandbox

```


```
yarn test

``` 

![image](https://user-images.githubusercontent.com/44075582/126524242-6fdd8cf3-a5b5-4143-b46f-97eb7a0a2e73.png)


```
yarn stop-sandbox

```

# Compile contract

```
yarn compile

```

# Deploy contract

```
yarn migrate

```

# Contract entrypoints

##### This section is WIP

### `add_asset`

This entrypoint is used to enable bets with either TEZ of FA2 tokens.

| Name   | Type    | Description |
|--------|---------|------------|
| payout_quot_f | nat | Payout quotient for the current asset with precision of 1e18. For example, the quotient equal 1.5e18 means that `bid_size * 1.5` is paid to the gamer in case their bid wins |
| max_bet_percent_f | nat | Maximal ratio of bid size to asset bank with precision of 1e18. For example, the value equal to 5e17 means that the maximal bid size is 50% of the asset bank |
| asset | asset_t | Asset for which bets should be enabled |

##### Preconditions

- the caller of the entrypoint is admin;
- `payout_quot_f` is in range \[(10^{18}; 2 \cdot 10^{18}]\]
- `max_bet_percent_f` is in range \[(0; 10^{18})\]
- the specified asset has not been added yet;

##### Postconditions

Note: new asset ID is equal to previous `games_counter` value.
- a new pair is created in `asset_to_id` bigmap with key equal to `asset` value, which is converted to bytes, and value equal to new asset ID. See `getAssetKey` method in [bytes-keys.ts](utils/byte-keys.ts) for the way to get that key using Taquito;
- a new pair is created in `id_to_asset` bigmap with key equal to new asset ID and value equal to record with these parameters:
  * `asset` equal to `asset`;
  * `payout_quot_f` equal to `payout_quot_f`;
  * `bank` equal to 0;
  * `max_bet_percent_f` equal to `max_bet_percent_f`;
  * `total_won_amt` equal to 0;
  * `total_lost_amt` equal to 0;
  * `total_bets_amt` equal to 0;
  * `games_count` equal to 0;
  * `paused` equal to False.
- `assets_counter` is increased by 1.

##### Returned operations

No operations are returned.

### `bet`

This entrypoint is used to start a game.

##### Input parameters

| Name   | Type    | Description |
|--------|---------|------------|
| asset_id | nat | ID of the asset for bid from `asset_to_id` bigmap |
| bid_size | nat | Amount of asset for bid |
| coin_side | coin_side_t | Coin side which is chosen for bet |

##### Preconditions

- the entrypoint is called by a classic account rather than smart contract;
- bid size is positive;
- asset with specified id exists in `id_to_asset` bigmap;
- bets for the specified asset are not paused;
- bid size does not exceed the maximal size, which is equal to `max_bet_percent_f * bank / 1e18`;
- the caller must have at least `bid_size` of the specified asset if it is a FA2 token;
- `amount` from transaction parameters is equal to:
  * `network_fee` if the specified asset is a FA2 token;
  * `network_fee + bid_size` otherwise.
- This smart contract must be an operator of sender for the specified FA2 asset.

##### Postconditions

Note: new game ID is equal to previous `games_counter` value.
- a new pair is created in `games` bigmap with key equal to new game ID and value equal to record with these parameters:
  * `asset_id` equal to `asset_id`;
  * `gamer` equal to the entrypoint caller address;
  * `start` equal to the block timestamp;
  * `bid_size` equal to `bid_size`;
  * `bet_coin_side` equal to `coin_side`;
  * `status` equal to `Started`.
- `games_counter` is increased by 1;
- the value in `id_to_asset` bigmap for `asset_id` key takes these changes:
  * `total_bets_amt` is increased by `bid_size`;
  * `games_count` is increased by 1.
- if the entrypoint caller calls `bet` entrypoint for the first time, a new pair is created in `gamers_stats` with key equal to the (entrypoint caller address, asset id) tuple and value equal to record with these parameters:
  * `last_game_id` equal to new game ID;
  * `games_count` equal to 1;
  * `total_won_amt` equal to 0;
  * `total_lost_amt` equal to 0;
  * `total_bets_amt` equal to 1;
- if the entrypoint caller has called `bet` entrypoint before, the value in `gamers_stats` for the (entrypoint caller address, asset id) tuple takes these changes:
  * `last_game_id` becomes equal to new game ID;
  * `games_count` is increased by 1;
  * `total_bets_amt` is increased by 1.
- `network_bank` is increased by `network_fee`.

##### Returned operations

If the specified asset is TEZ, no operations are returned; otherwise a transfer of `bid_size` amount of the specified FA2 token from the entrypoint caller to this contract is returned.
