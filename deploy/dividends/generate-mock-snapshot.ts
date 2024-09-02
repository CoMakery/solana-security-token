import { Keypair } from "@solana/web3.js";
import fs from "fs";

const WALLETS_COUNT = 100000;
const decimals = 6;
const distributionAmountInBaseUnit = 1000000 * 10 ** decimals;

const csvFilePath = `snapshot_${WALLETS_COUNT}.csv`;
let amountLeft = distributionAmountInBaseUnit;
for (let index = 0; index < WALLETS_COUNT; index++) {
  const investor = Keypair.generate();
  const randomNumber =
    Math.floor(Math.random() * ((3 * amountLeft) / WALLETS_COUNT)) + 1;
  const csvData = `${investor.publicKey.toString()},${randomNumber}\n`;

  fs.appendFileSync(csvFilePath, csvData);
  amountLeft -= randomNumber;
}
console.log(`Total amount distributed: ${distributionAmountInBaseUnit - amountLeft}`);
