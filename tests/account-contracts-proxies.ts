import BigNumber from 'bignumber.js';

import { initTezos } from '../utils/helpers';
import { Tezos, signerAlice } from './utils/cli';
import {
  Asset,
  Coinflip,
  CoinflipStorage,
  TEZ_ASSET
} from './coinflip';
import defaultStorage from './storage/coinflip';
import { FA2 } from './helpers/FA2';
import { fa2Storage } from './storage/fa2';
import { makeStorage } from './helpers';
import {
  defaultPayout,
  defaultMaxBetPercentage,
  withdrawalTestTezBank,
  withdrawalTestFa2TokenBank,
  withdrawalTestNetworkBank,
  defaultFA2TokenId
} from './constants';

interface AccountContractsProxies {
  emptyCoinflip: Coinflip;
  fa2: FA2;
  allAssetsAddedCoinflip: Coinflip;
  allAssetsWithBankCoinflip: Coinflip;
}

export type CoinflipType = Exclude<keyof AccountContractsProxies, 'fa2'>;

const makeAssetEntry = (asset: Asset, bank: BigNumber.Value = 0) => ({
  asset,
  payout_quotient: defaultPayout,
  bank: new BigNumber(bank),
  max_bet_percent: defaultMaxBetPercentage
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
        makeAssetEntry(TEZ_ASSET),
        makeAssetEntry({
          fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) }
        })
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
        makeAssetEntry(TEZ_ASSET, withdrawalTestTezBank),
        makeAssetEntry(
          { fa2: { address: fa2TokenAddress, id: new BigNumber(fa2TokenId) } },
          withdrawalTestFa2TokenBank
        )
      ],
      withdrawalTestNetworkBank
    )
  );
}
