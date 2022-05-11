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
