import { execSync } from "child_process";
import config from "../../../config";
import {
  FlextesaAccounts,
  FlextesaOptions,
  FlextesaTezosProtocol,
  FlextesaTezosProtocols,
  TezosProtocols,
} from "./types";

export const flextesaProtocols: FlextesaTezosProtocols = {
  [TezosProtocols.ITHACA]: {
    hash: "Psithaca2MLRFYargivpo7YvUr7wUDqyxrdhC5CQq78mRvimz6A",
    prefix: "012-Psithaca",
    kind: "Ithaca"
  },
  [TezosProtocols.JAKARTA]: {
    hash: "PtJakart2xVj7pYXJBXrqHgd82rdkLey5ZeeGwDgPp9rhQUbSqY",
    prefix: "013-Psjakarta",
    kind: "Jakarta"
  }
};

export async function useSandbox(options: { up?: boolean; down?: boolean }) {
  const running = await isFlextesaRunning();
  if (Object.keys(options).length === 0) {
    if (running) await stopFlextesa();
    else
      await startFlextesa({
        host: config.networks.sandbox.host,
        port: config.networks.sandbox.port,
        accounts: config.networks.sandbox.accounts,
      });
  } else {
    if (options.up && options.down) {
      console.error(
        "Must specify '--up (--start)' OR '--down (--stop)', not both!"
      );
      return;
    } else if (options.up)
      await startFlextesa({
        host: config.networks.sandbox.host,
        port: config.networks.sandbox.port,
        accounts: config.networks.sandbox.accounts,
      });
    else if (options.down) await stopFlextesa();
  }
}

export const createAccountsParams = (
  accounts: FlextesaAccounts,
  amountTz = 100
): string[] => {
  const balance: number = amountTz * Math.pow(10, 9); // XTZ in mutez
  const params: string[] = [];

  for (const name in accounts) {
    const account = accounts[name];

    params.push(
      ...[
        "--add-bootstrap-account",
        `${name},${account.pk},${account.pkh},unencrypted:${account.sk}@${balance}`,
        "--no-daemons-for",
        name, // DON'T USE THIS OPTION TOGETHER WITH --remove-default-bootstrap-accounts OTHERWISE TAQUITO GETS ANGRY BECAUSE OF EMPTY HEADER BLOCKS
      ]
    );
  }

  return params;
};

export const createProtocolParams = (
  tezosProtocol: TezosProtocols
): string[] => {
  const protocol: FlextesaTezosProtocol = flextesaProtocols[tezosProtocol];

  // Configure Tezos node apps with the proper one for selected protocol version
  const params: string[] = [];

  // Specify protocol version and hash
  params.push(
    "--protocol-hash",
    `${protocol.hash}`,
    "--protocol-kind",
    `${protocol.kind}`
  );

  return params;
};

// Flextesa image
const FLEXTESA_IMAGE = "oxheadalpha/flextesa:20220510";

// Name for the running Docker image
export const POD_NAME = "flextesa-sandbox";

const defaultProtocol = TezosProtocols.JAKARTA;
const defaultOptions: FlextesaOptions = config.networks.sandbox;

export const startFlextesa = async (
  _options: Partial<FlextesaOptions>,
  readyCallback?: () => void
): Promise<void> => {
  console.log(`Preparing Flextesa sandbox...`);

  // Merge with defaults
  const options = Object.assign({}, defaultOptions, _options);

  // Localhost is not a valid host for Docker
  const host = options.host.includes("localhost") ? "0.0.0.0" : options.host;
  const port = options.port;

  // Protocol "validity" checks
  const protocol =
    !options.protocol || !flextesaProtocols[options.protocol]
      ? defaultProtocol
      : options.protocol;

  const accountsParams = createAccountsParams(options.accounts || {});
  const tezosNodeParams = createProtocolParams(protocol);

  const args = [
    "run",
    "--rm",
    "-d",
    "--name",
    POD_NAME,
    "-p",
    host + ":" + port + ":20000",
    "--env",
    "flextesa_node_cors_origin=*",
    FLEXTESA_IMAGE,
    "flextesa",
    "mini-net",
    "--genesis-block-hash",
    options.genesisBlockHash,
    // "--remove-default-bootstrap-accounts"
    /**
     * Please don't use --remove-default-bootstrap-accounts in conjunction with
     * --no-daemons-for on every added account. This would have Flextesa not baking
     * anything, so the header block would be empty and Taquito does not really like it!
     */
    "--time-between-blocks",
    "2",
    // "--minimal-block-delay", "1",
    "--until-level",
    "200000000",
    "--pause-on-error=true",
    ...accountsParams,
    ...tezosNodeParams,
  ];

  console.debug(`Starting Flextesa with these arguments:`);
  console.debug("docker " + args.join(" "));

  execSync("docker " + args.join(" "));
  console.log("Sandbox started");
  if (readyCallback) readyCallback();
  return;
};

export const stopFlextesa = (callback?: () => void): void => {
  try {
    execSync(`docker rm -f ${POD_NAME}`);
    console.log("Sandbox stopped");
  } catch (e) {
    console.error("Stopping Flextesa thrown:", e);
  }
  callback && callback();
};

export const isFlextesaRunning = async (): Promise<boolean> => {
  try {
    const buffer = execSync(`docker ps -f name=${POD_NAME} -q`);

    return buffer.length !== 0;
  } catch (e) {
    return false;
  }
};
