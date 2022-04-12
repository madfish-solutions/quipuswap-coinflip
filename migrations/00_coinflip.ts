import { TezosToolkit } from "@taquito/taquito";

import config from "../config";
import { migrate } from "../scripts/commands/migrate/utils";
import storage from "../storage/coinflip";
import { NetworkLiteral, TezosAddress } from "../utils/helpers";

module.exports = async (tezos: TezosToolkit, network: NetworkLiteral) => {
  const contractAddress: TezosAddress = await migrate(
    tezos,
    config.outputDirectory,
    "coinflip",
    storage,
    network
  );
  console.log(`Coinflip contract address: ${contractAddress}`);
};
