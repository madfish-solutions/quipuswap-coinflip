import { MichelsonMap } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { initTezos } from '../utils/helpers';
import { Tezos, signerAlice } from './utils/cli';
import {
  Asset,
  AssetRecord,
  Coinflip,
  CoinflipStorage,
  Game,
  GamerStats,
  TEZ_ASSET
} from './coinflip';
import defaultStorage from './storage/coinflip';
import { FA2 } from './helpers/FA2';
import { fa2Storage } from './storage/fa2';
import {
  defaultPayout,
  defaultMaxBetPercentage,
  testTezBank,
  testFa2TokenBank,
  testNetworkBank,
  defaultFA2TokenId,
  testGames,
  PRECISION,
  tezAssetId,
  defaultFA2AssetId
} from './constants';

const makeStorage = (
  assets: AssetRecord[] = [],
  networkBank: BigNumber.Value = 0,
  networkFee: BigNumber.Value = defaultStorage.network_fee,
  games: Game[] = []
): CoinflipStorage => ({
  ...defaultStorage,
  network_fee: new BigNumber(networkFee),
  network_bank: new BigNumber(networkBank),
  assets_counter: new BigNumber(assets.length),
  asset_to_id: MichelsonMap.fromLiteral(
    Object.fromEntries(
      assets.map((asset, index) => [
        Coinflip.getAssetKey(asset.asset),
        new BigNumber(index)
      ])
    )
  ) as CoinflipStorage['asset_to_id'],
  id_to_asset: MichelsonMap.fromLiteral(
    Object.fromEntries(assets.map((asset, index) => [index.toString(), asset]))
  ) as CoinflipStorage['id_to_asset'],
  games_counter: new BigNumber(games.length),
  games: MichelsonMap.fromLiteral(
    Object.fromEntries(games.map((game, index) => [index.toString(), game]))
  ) as CoinflipStorage['games'],
  gamers_stats: MichelsonMap.fromLiteral(
    games.reduce<Record<string, GamerStats>>(
      (statsPart, game, index) => {
        const key = Coinflip.getAccountAssetIdPairKey(
          game.gamer,
          game.asset_id
        );
        const prevGamerStats = statsPart[key] ?? {
          last_game_id: new BigNumber(0),
          games_count: new BigNumber(0),
          total_won_amt: new BigNumber(0),
          total_lost_amt: new BigNumber(0),
          total_bets_amt: new BigNumber(0)
        };
        const { payout_quot_f } = assets[game.asset_id.toNumber()];
        const won_amt = payout_quot_f.times(game.bid_size).idiv(PRECISION);
        statsPart[key] = {
          last_game_id: new BigNumber(index),
          games_count: prevGamerStats.games_count.plus(1),
          total_won_amt: prevGamerStats.total_won_amt.plus(
            'won' in game.status ? won_amt : 0
          ),
          total_bets_amt: prevGamerStats.total_bets_amt.plus(
            game.bid_size
          ),
          total_lost_amt: prevGamerStats.total_lost_amt.plus(
            'lost' in game.status ? game.bid_size : 0
          )
        };

        return statsPart;
      },
      {}
    )
  ) as CoinflipStorage['gamers_stats']
});

export const makeAssetRecord = (
  asset: Asset,
  bank: BigNumber.Value = 0,
  paused = false,
  games: Game[] = []
) => {
  const { total_won_amt, total_lost_amt } = games.reduce(
    (
      { total_won_amt: prevTotalWonAmt, total_lost_amt: prevTotalLostAmt },
      { bid_size, status }
    ) => ({
      total_won_amt: 'won' in status
        ? prevTotalWonAmt.plus(defaultPayout.times(bid_size).idiv(PRECISION))
        : prevTotalWonAmt,
      total_lost_amt: 'lost' in status
        ? prevTotalLostAmt.plus(bid_size)
        : prevTotalLostAmt
    }),
    { total_won_amt: new BigNumber(0), total_lost_amt: new BigNumber(0) }
  );

  return {
    asset,
    payout_quot_f: defaultPayout,
    bank: new BigNumber(bank),
    max_bet_percent_f: defaultMaxBetPercentage,
    total_won_amt,
    total_lost_amt,
    games_count: new BigNumber(games.length),
    paused
  };
};

Tezos.setSignerProvider(signerAlice);

async function makeCoinflip(storage: CoinflipStorage): Promise<
  Record<string, Coinflip>
> {
  const aliceCoinflip = await Coinflip.originateWithTransfers(Tezos, storage);

  const result = { alice: aliceCoinflip };
  await Promise.all(['bob', 'carol'].map(
    async alias => result[alias] = await Coinflip.init(
      alias,
      aliceCoinflip.contractAddress
    )
  ));

  return result;
}

export async function makeEmptyCoinflip() {
  console.log('Originating coinflip contract without assets...');
  return makeCoinflip(defaultStorage);
}

export async function makeFA2(): Promise<Record<string, FA2>> {
  console.log('Originating FA2 token contract...');
  const aliceFA2 = await FA2.originate(Tezos, fa2Storage);

  const result = { alice: aliceFA2 };
  await Promise.all(['bob', 'carol'].map(
    async alias => result[alias] =
      await FA2.init(aliceFA2.contract.address, await initTezos(alias))
  ));

  return result;
}

export async function makeAllAssetsAddedCoinflip(
  fa2TokenAddress: string,
  fa2TokenId = defaultFA2TokenId
) {
  console.log('Originating coinflip contract with assets with empty banks...');
  return makeCoinflip(
    makeStorage(
      [
        makeAssetRecord(TEZ_ASSET),
        makeAssetRecord(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) } },
          0,
          true
        )
      ]
    )
  );
}

export async function makeAllAssetsWithBankCoinflip(
  fa2TokenAddress: string,
  fa2TokenId = defaultFA2TokenId
) {
  console.log(
    'Originating coinflip contract with assets with non-empty banks and transfering assets to it...'
  );
  return makeCoinflip(
    makeStorage(
      [
        makeAssetRecord(TEZ_ASSET, testTezBank),
        makeAssetRecord(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) } },
          testFa2TokenBank
        ),
        makeAssetRecord(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId + 1) } },
          0,
          true
        )
      ],
      testNetworkBank
    )
  );
}

export async function makeAssetsWithGamesCoinflip(
  fa2TokenAddress: string,
  fa2TokenId = defaultFA2TokenId,
  games = testGames,
  assetEntries?: AssetRecord[]
) {
  console.log(
    'Originating coinflip contract with games and transfering assets to it...'
  );
  return makeCoinflip(
    makeStorage(
      assetEntries ?? [
        makeAssetRecord(
          TEZ_ASSET,
          testTezBank,
          false,
          games.filter(({ asset_id }) => asset_id.eq(tezAssetId))
        ),
        makeAssetRecord(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) } },
          testFa2TokenBank,
          false,
          games.filter(({ asset_id }) => asset_id.eq(defaultFA2AssetId))
        ),
        makeAssetRecord(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId + 1) } },
          0,
          true
        )
      ],
      testNetworkBank,
      defaultStorage.network_fee,
      games
    )
  );
}
