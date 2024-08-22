import {
  Keypair,
  Connection,
  Commitment,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findClaimStatusKey,
  findDistributorKey,
} from "../../app/src/merkle-distributor";
import { MintHelper } from "../helpers/mint_helper";
import { BN, Program } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { toBytes32Array } from "../../app/src/merkle-distributor/utils";

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
