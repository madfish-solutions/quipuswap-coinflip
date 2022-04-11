import { MichelsonMap } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { alice, bob } from "../../scripts/sandbox/accounts";

export default {
  admin: alice.pkh,
  oracle: bob.pkh,
  gas_comission: 0,
  payout: new BigNumber(10).pow(18).times(1.5),
  win_percentage: new BigNumber(63),
  token_address: '',
  games_count: new BigNumber(0),
  games: MichelsonMap.fromLiteral({})
};
