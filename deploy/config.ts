import BN from "bn.js";
const { clusterApiUrl } = require("@solana/web3.js");

export type Config = {
  cluster: string;
  rpcUrl: string;
  mint: {
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
  };
  maxHolders: BN;
  maxTotalSupply: BN;
  tokenlock: {
    maxReleaseDelay: BN;
    minTimelockAmount: BN;
    space: number;
  };
  commitment: string;
  admins: {
    key: string;
    role: number;
  }[];
};

export function getConfig(cluster: string, _rpcUrl?: string): Config {
  let rpcUrl =
    cluster === "localnet"
      ? "http://localhost:8899"
      : _rpcUrl || clusterApiUrl(cluster);

  const decimals = 6;
  return {
    cluster,
    rpcUrl,
    mint: {
      decimals,
      name: "Sec XYZ Token",
      symbol: "SECXYZ",
      uri: "https://arweave.net/loW2I4LojGewSbhPcrGWEeC0YpAUeZ_32z5t9SO_yiI",
    },
    maxHolders: new BN(1000000),
    maxTotalSupply: new BN(1_000_000_000).muln(10 ** decimals),
    tokenlock: {
      maxReleaseDelay: new BN(346896000),
      minTimelockAmount: new BN(100),
      space: 1 * 1024 * 1024, // 1MB, max 10MB limited by on-chain max account size
    },
    commitment: "confirmed",
    admins: [{ key: "Fd3EfUVeS4x3pDu43YghgpDMsDrdwZQQGutaVKLLxKGV", role: 15 }],
  };
}
