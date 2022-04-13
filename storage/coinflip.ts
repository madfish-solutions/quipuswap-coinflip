import { MichelsonMap } from '@taquito/taquito';

import { alice, bob } from "../scripts/sandbox/accounts";

export default {
  admin: alice.pkh,
  server: bob.pkh,
  games_counter: 0,
  games: MichelsonMap.fromLiteral({}),
  assets_counter: 0,
  network_fee: 100,
  asset_to_id: MichelsonMap.fromLiteral({}),
  id_to_asset: MichelsonMap.fromLiteral({}),
  network_bank: 0
};
