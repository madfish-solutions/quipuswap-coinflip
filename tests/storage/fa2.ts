import { MichelsonMap } from '@taquito/michelson-encoder';

import { alice, bob, carol } from '../../scripts/sandbox/accounts';
import { FA2Storage } from '../types/FA2';

const totalSupply: number = 100_000_000_000;

export const fa2Storage: FA2Storage = {
  account_info: MichelsonMap.fromLiteral({
    [alice.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: Math.floor(totalSupply / 3),
      }),
      allowances: [],
    },
    [bob.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: Math.floor(totalSupply / 3),
      }),
      allowances: [],
    },
    [carol.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: Math.floor(totalSupply / 3),
      }),
      allowances: [],
    },
  }),
  token_info: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
  minters_info: MichelsonMap.fromLiteral({}),
  last_token_id: 1,
  admin: alice.pkh,
  permit_counter: 0,
  permits: MichelsonMap.fromLiteral({}),
  default_expiry: 1000,
  total_minter_shares: 0,
};
