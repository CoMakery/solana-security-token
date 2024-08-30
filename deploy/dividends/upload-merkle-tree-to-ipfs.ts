/// Usage:
/// ts-node deploy/dividends/upload-merkle-tree-to-ipfs.ts -f deploy/dividends/snapshot_1000.csv

import * as dotenv from "dotenv";
dotenv.config();
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import { Command } from "commander";

const program = new Command();
program
  .requiredOption("-f --filepath <path>", "Specify the path to csv file")
  .parse(process.argv);

export const options = program.opts();

import {
  BalanceTree,
  NewFormat,
  parseBalanceMap,
} from "../../app/src/merkle-distributor/utils";
import IpfsInfuraHelper from "./ipfs-infura-helper";

const elements: NewFormat[] = [];
const elementsBalanceTree: { account: PublicKey; amount: BN }[] = [];

// Function to load the CSV file and populate the elements array
function loadCSVFile(filePath: string): void {
  const data = fs.readFileSync(filePath, "utf-8");
  const lines = data.split("\n");

  lines.forEach((line) => {
    const [accountString, amountString] = line.split(",");
    if (accountString && amountString) {
      elements.push({ address: accountString, earnings: amountString });
      elementsBalanceTree.push({
        account: new PublicKey(accountString),
        amount: new BN(amountString),
      });
    }
  });
}

(async () => {
  const csvFilePath = options.filepath;
  console.log("Loading snapshot from CSV file");
  loadCSVFile(csvFilePath);
  console.log("Snapshot has been loaded from CSV file");

  const balanceTree = new BalanceTree(elementsBalanceTree);

  const merkleDistributorInfo = parseBalanceMap(elements);
  console.log("BALANCE TREE", balanceTree.getHexRoot());
  console.log("*".repeat(50));
  console.log("Merkle Distributor Info downloaded:");
  console.log("\t merkleRoot:", merkleDistributorInfo.merkleRoot);
  console.log("\t tokenTotal:", merkleDistributorInfo.tokenTotal);
  console.log(
    "\t investors count:",
    Object.keys(merkleDistributorInfo.claims).length
  );
  console.log("*".repeat(50));
  console.log(JSON.stringify(merkleDistributorInfo));
  console.log("*".repeat(50));

  const ifpsHelper = new IpfsInfuraHelper(
    process.env.IPFS_PROJECT_ID,
    process.env.IPFS_PROJECT_SECRET
  );
  console.log("Uploading Merkle Distributor Info to IPFS");

  const blob = new Blob([JSON.stringify(merkleDistributorInfo)], {
    type: "text/plain",
  });
  const formData = new FormData();
  formData.append("file", blob, "merkle-tree-distribution-info.json");

  const result = await ifpsHelper.add(formData)
  console.log(result);
  console.log("*".repeat(50));
})();
