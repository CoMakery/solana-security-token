/// Usage:
/// ts-node deploy/dividends/get-ipfs-file.ts --hash QmW5Xjdp2Jd9CzWRguAoqVVrMWc6mzyUQHyQZqbf3aWip2

import * as dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import fs from "fs";
import { PublicKey } from "@solana/web3.js";

import {
  BalanceTree,
} from "../../app/src/merkle-distributor/utils";
import BN from "bn.js";
const program = new Command();
program
  .requiredOption("-h --hash <hash>", "Specify the path to csv file")
  .requiredOption("-gu --gateway_url <url>", "Specify the path to ipfs gateway")
  .parse(process.argv);

export const options = program.opts();

type BufferData = {
  type: string;
  data: number[];
};

type IpfsDataTypes = {
  merkleRoot: BufferData;
  tokenTotal: string;
  claims: {
    [account: string]: {
      index: number;
      amount: string;
      proof: BufferData[];
    };
  };
  data: BufferData[];
};

(async () => {
  const ipfsHash = options.hash;
  const ipfsGatewayUrl = options.gateway_url;
  console.log("Downloading file from IPFS", ipfsHash);
  const response = await fetch(`${ipfsGatewayUrl}/${ipfsHash}`);
  const result = await response.json() as IpfsDataTypes;

  fs.writeFileSync(`ipfs_${ipfsHash}.json`, JSON.stringify(result));
  console.log(`File has been downloaded and saved to ipfs_${ipfsHash}.json`);
})();

