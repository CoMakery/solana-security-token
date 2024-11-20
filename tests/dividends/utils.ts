import {
  Keypair,
  Connection,
  Commitment,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createMint,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  findClaimStatusKey,
  findDistributorKey,
} from "../../app/src/merkle-distributor";
import { MintHelper } from "../helpers/mint_helper";
import { BN, Program } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { toBytes32Array } from "../../app/src/merkle-distributor/utils";
import { solToLamports, topUpWallet } from "../utils";

export type DistributorResult = {
  mintKeypair: Keypair;
  mintHelper: MintHelper;
  baseKey: Keypair;
  distributor: PublicKey;
  bump: number;
  distributorATA: PublicKey;
};

export async function createDistributor(
  connection: Connection,
  decimals: number,
  signer: Keypair,
  programId: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
  commitment: Commitment = "confirmed"
): Promise<DistributorResult> {
  const mintKeypair = Keypair.generate();
  await createMint(
    connection,
    signer,
    signer.publicKey,
    null,
    decimals,
    mintKeypair,
    { commitment },
    tokenProgramId
  );
  const baseKey = Keypair.generate();
  const [distributor, bump] = findDistributorKey(baseKey.publicKey, programId);
  const mintHelper = new MintHelper(
    connection,
    mintKeypair.publicKey,
    commitment,
    tokenProgramId
  );
  const distributorATA = mintHelper.getAssocciatedTokenAddress(
    distributor,
    true
  );
  const distributorATAAccountData = await connection.getAccountInfo(
    distributorATA,
    commitment
  );
  if (distributorATAAccountData === null) {
    await mintHelper.createAssociatedTokenAccount(distributor, signer, true);
  }

  return {
    mintKeypair,
    mintHelper,
    baseKey,
    distributor,
    bump,
    distributorATA,
  };
}

export async function claim(
  program: Program<Dividends>,
  index: BN,
  amount: BN,
  proof: Buffer[],
  claimant: Keypair,
  distributor: PublicKey,
  mintHelper: MintHelper,
  payer: Keypair,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
  commitment: Commitment = "confirmed"
): Promise<string> {
  const [claimPubkey, claimBump] = findClaimStatusKey(
    new BN(index),
    distributor,
    program.programId
  );
  const proofBytes = proof.map((p) => toBytes32Array(p));

  const distributorATA = mintHelper.getAssocciatedTokenAddress(
    distributor,
    true
  );
  const claimantATA = mintHelper.getAssocciatedTokenAddress(claimant.publicKey);
  if (
    (await program.provider.connection.getAccountInfo(claimantATA)) === null
  ) {
    await mintHelper.createAssociatedTokenAccount(claimant.publicKey, payer);
  }

  return program.methods
    .claim(claimBump, index, amount, proofBytes)
    .accountsStrict({
      distributor,
      claimStatus: claimPubkey,
      from: distributorATA,
      to: claimantATA,
      claimant: claimant.publicKey,
      payer: payer.publicKey,
      mint: mintHelper.mintPubkey,
      tokenProgram: tokenProgramId,
      systemProgram: SystemProgram.programId,
    })
    .signers([claimant, payer])
    .rpc({ commitment });
}

// Function to create a mock Token-2022 with Transfer Fee enabled
export async function createMockTokenWithTransferFee(
  connection: Connection,
  decimals: number = 6, // 6 decimals
  feeBasisPoints: number = 0, // 0% fee,
  maxFee: bigint = BigInt(5000) // Max fee of 0.05 tokens (in smallest unit)
): Promise<{
  mint: PublicKey;
  payer: Keypair;
  feeReceiver: PublicKey;
  mintAuthority: Keypair;
  transferFeeConfigAuthority: Keypair;
}> {
  // Create a payer keypair for testing
  const payer = Keypair.generate();
  const mintAuthority = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const transferFeeConfigAuthority = Keypair.generate();
  const withdrawWithheldAuthority = Keypair.generate();
  // Generate new keypair for Mint Account
  const mintKeypair = Keypair.generate();
  // Address for Mint Account
  const mint = mintKeypair.publicKey;

  // Airdrop some SOL to the payer
  await topUpWallet(connection, payer.publicKey, solToLamports(1));

  // Size of Mint Account with extensions
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  // Minimum lamports required for Mint Account
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  // Instruction to invoke System Program to create new account
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
    newAccountPubkey: mint, // Address of the account to create
    space: mintLen, // Amount of bytes to allocate to the created account
    lamports, // Amount of lamports transferred to created account
    programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
  });

  // Instruction to initialize TransferFeeConfig Extension
  const initializeTransferFeeConfig =
    createInitializeTransferFeeConfigInstruction(
      mint, // Mint Account address
      transferFeeConfigAuthority.publicKey, // Authority to update fees
      withdrawWithheldAuthority.publicKey, // Authority to withdraw fees
      feeBasisPoints, // Basis points for transfer fee calculation
      maxFee, // Maximum fee per transfer
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

  // Instruction to initialize Mint Account data
  const initializeMintInstruction = createInitializeMintInstruction(
    mint, // Mint Account Address
    decimals, // Decimals of Mint
    mintAuthority.publicKey, // Designated Mint Authority
    freezeAuthority.publicKey, // Optional Freeze Authority
    TOKEN_2022_PROGRAM_ID // Token Extension Program ID
  );

  // Add instructions to new transaction
  const transaction = new Transaction().add(
    createAccountInstruction,
    initializeTransferFeeConfig,
    initializeMintInstruction
  );

  // Send transaction
  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair] // Signers
  );

  return {
    mint,
    payer,
    feeReceiver: withdrawWithheldAuthority.publicKey,
    mintAuthority,
    transferFeeConfigAuthority,
  };
}
