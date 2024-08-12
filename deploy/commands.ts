import { Command } from "commander";

const program = new Command();
program
  .requiredOption(
    "-c --cluster <type>",
    "Specify the cluster: localnet, devnet, mainnet"
  )
  .parse(process.argv);

export const options = program.opts();
