import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";
import BigNumber from 'bignumber.js';

export type UserFA2Info = {
  balances: MichelsonMap<MichelsonMapKey, BigNumber>;
  allowances: string[];
};

export type UserFA2LPInfo = {
  balance: number;
  frozen_balance: number;
  allowances: string[];
};

export type OperatorParam = {
  owner: string;
  operator: string;
  token_id: number;
};

export type UpdateOperatorParam =
  | { add_operator: OperatorParam }
  | { remove_operator: OperatorParam };

export type TransferDst = {
  to_: string;
  token_id: number;
  amount: number;
};

export type TransferParam = {
  from_: string;
  txs: TransferDst[];
};

export type Minter = {
  minter: string;
  share: number;
};

export type MintGovTokenParams = {
  receiver: string;
  amount: number;
};

export type BalanceRequest = {
  owner: string;
  token_id: number;
};

export type BalanceResponse = {
  request: BalanceRequest;
  balance: number;
};

export type FA2Storage = {
  account_info: MichelsonMap<MichelsonMapKey, UserFA2Info>;
  token_info: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
  minters_info: MichelsonMap<MichelsonMapKey, unknown>;
  last_token_id: number;
  admin: string;
  permit_counter: number;
  permits: MichelsonMap<MichelsonMapKey, unknown>;
  default_expiry: number;
  total_minter_shares: number;
};
