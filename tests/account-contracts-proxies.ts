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
  testGames
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
  ) as CoinflipStorage['games']
});

export const makeAssetRecord = (
  asset: Asset,
  bank: BigNumber.Value = 0,
  paused = false
) => ({
  asset,
  payout_quot_f: defaultPayout,
  bank: new BigNumber(bank),
  max_bet_percent_f: defaultMaxBetPercentage,
  paused
});

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
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) } }
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
      testNetworkBank,
      defaultStorage.network_fee,
      games
    )
  );
}
