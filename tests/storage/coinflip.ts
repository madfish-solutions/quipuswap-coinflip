import { MichelsonMap } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { alice, bob } from "../../scripts/sandbox/accounts";
import { CoinflipStorage } from '../coinflip';

const storage: CoinflipStorage = {
  admin: alice.pkh,
  server: bob.pkh,
  games_counter: new BigNumber(0),
  games: MichelsonMap.fromLiteral({}) as CoinflipStorage['games'],
  assets_counter: new BigNumber(0),
  network_fee: new BigNumber(100),
  asset_to_id: MichelsonMap.fromLiteral({}) as CoinflipStorage['asset_to_id'],
  id_to_asset: MichelsonMap.fromLiteral({}) as CoinflipStorage['id_to_asset'],
  network_bank: new BigNumber(0)
};

export default storage;
