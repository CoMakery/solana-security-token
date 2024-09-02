import * as dotenv from "dotenv";
dotenv.config();
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
  Commitment,
} from "@solana/web3.js";
import {
  getAccessControlProgram,
  getDividendsProgram,
  loadKeypairFromFile,
} from "../helpers";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { options } from "../commands";
import { findDistributorKey } from "../../app/src/merkle-distributor";
import { toBytes32Array } from "../../_sdk/merkle-distributor/utils";
import { AccessControlHelper } from "../../tests/helpers/access-control_helper";
import { MintHelper } from "../../tests/helpers/mint_helper";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

type DividendsConfig = {
  accessControl: PublicKey;
  securityMint: PublicKey;
  dividendsMint: PublicKey;
  dividendsAmount: BN;
  rootProof: Buffer;
  claimantsCount: BN;
  commitment: Commitment;
  dividendsTokenProgramId: PublicKey;
  ipfsHash: string;
};

const config: DividendsConfig = {
  accessControl: new PublicKey("FxpEmMdLUXHv7qmvbGeB7JEyVzkScvr1wZXR6K2nPjSy"), // AccessControl Data Account for Security Mint
  securityMint: new PublicKey("HgbQJA9h17oJZzSpHoHRQ5zL1xugifVWgnifseAECxzn"), // Security Mint
  dividendsMint: new PublicKey("HU2SxhuawUkLMznhc5Ew5Xkbm7UsEVXCNe6zWZb92sjn"), // Dividends Mint
  dividendsAmount: new BN(10000000), // Distribution amount in base unit
  rootProof: Buffer.alloc(32), // root proof for the distribution merkle tree
  claimantsCount: new BN(10), // Number of claimants
  commitment: "confirmed", // Commitment level
  dividendsTokenProgramId: TOKEN_PROGRAM_ID, // Token program ID for dividends mint
  ipfsHash: "QmQ9Q5Q6Q7Q8Q9QaQbQcQdQeQfQgQhQiQjQkQlQmQnQoQpQqQrQsQtQuQvQwQxQy", // IPFS hash for the distribution merkle tree data
};
const deployerKeypairPath = `deploy/${options.cluster}/keys/deployer.json`;

(async () => {
  const rpcUrl =
    options.cluster === "localnet"
      ? "http://localhost:8899"
      : process.env.RPC_URL || clusterApiUrl(options.cluster);
  const commitment = config.commitment as Commitment;

  const deployerKeypair = loadKeypairFromFile(deployerKeypairPath);
  const wallet = new Wallet(deployerKeypair);

  const connection = new Connection(rpcUrl, commitment);
  const provider = new AnchorProvider(connection, wallet, { commitment });
  const dividendsProgram = getDividendsProgram(provider);
  const accessControlProgram = getAccessControlProgram(provider);

  const baseKey = Keypair.generate();
  const [distributor, bump] = findDistributorKey(
    baseKey.publicKey,
    dividendsProgram.programId
  );

  const accessControlHelper = new AccessControlHelper(
    accessControlProgram,
    config.securityMint,
    commitment
  );
  console.log(`Configuration is initialized. Creating distributor...`);

  await dividendsProgram.methods
    .newDistributor(
      bump,
      toBytes32Array(config.rootProof),
      config.dividendsAmount,
      config.claimantsCount,
      config.ipfsHash
    )
    .accountsStrict({
      base: baseKey.publicKey,
      distributor,
      mint: config.dividendsMint,
      authorityWalletRole: accessControlHelper.walletRolePDA(
        deployerKeypair.publicKey
      )[0],
      accessControl: accessControlHelper.accessControlPubkey,
      payer: deployerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([deployerKeypair, baseKey])
    .rpc({ commitment });
  console.log(`Distributor created: ${distributor.toBase58()}`);

  const distributorData =
    await dividendsProgram.account.merkleDistributor.fetch(distributor);
  console.log(`Distributor data: ${JSON.stringify(distributorData)}`);

  const dividendsMintHelper = new MintHelper(
    connection,
    config.dividendsMint,
    config.commitment,
    config.dividendsTokenProgramId
  );
  const distributorATA = await dividendsMintHelper.createAssociatedTokenAccount(
    distributor,
    deployerKeypair,
    true
  );
  console.log(`Distributor ATA created: ${distributorATA.toBase58()}`);
})();
