import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN, utils } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { createMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MintHelper } from "../helpers/mint_helper";
import {
  getTransactionComputeUnits,
  solToLamports,
  topUpWallet,
} from "../utils";
import {
  BalanceTree,
  toBytes32Array,
} from "../../app/src/merkle-distributor/utils";

describe("claim-dividends", () => {
  const provider = AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);
  const commitment = "confirmed";

  const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;
  const decimals = 6;
  let mintKeypair: Keypair;

  const NUM_LEAVES = 100_000;
  const NUM_SAMPLES = 25;
  let baseKey: Keypair;
  let mintHelper: MintHelper;

  const elements: { account: PublicKey; amount: BN }[] = [];
  const investors: Keypair[] = [];

  for (let i = 0; i < NUM_LEAVES; i++) {
    const investor = Keypair.generate();
    const node = { account: investor.publicKey, amount: new BN(100) };
    elements.push(node);
    investors.push(investor);
  }
  const tree = new BalanceTree(elements);

  it("proof verification works", () => {
    const root = tree.getRoot();

    for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
      const account = investors[i].publicKey;
      const proof = tree.getProof(i, account, new BN(100));
      const validProof = BalanceTree.verifyProof(
        i,
        account,
        new BN(100),
        proof,
        root
      );
      assert.isTrue(validProof);
    }
  });

  describe("check compute budget on claims", () => {
    let distributor: PublicKey;
    let distributorATA: PublicKey;
    let bump: number;
    const signer = Keypair.generate();
    const maxTotalClaim = 100 * NUM_LEAVES;

    before(async () => {
      await topUpWallet(connection, signer.publicKey, solToLamports(10));
      mintKeypair = Keypair.generate();
      await createMint(
        connection,
        signer,
        signer.publicKey,
        null,
        decimals,
        mintKeypair,
        { commitment },
        TOKEN_PROGRAM_ID
      );
      baseKey = Keypair.generate();
      [distributor, bump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("MerkleDistributor"),
          baseKey.publicKey.toBytes(),
        ],
        dividendsProgram.programId
      );
      mintHelper = new MintHelper(
        connection,
        mintKeypair.publicKey,
        commitment,
        TOKEN_PROGRAM_ID
      );
      distributorATA = await mintHelper.createAssociatedTokenAccount(
        distributor,
        signer,
        true
      );

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          new BN(maxTotalClaim),
          new BN(NUM_LEAVES)
        )
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: mintKeypair.publicKey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer, baseKey])
        .rpc({ commitment });

      await mintTo(
        connection,
        signer,
        mintKeypair.publicKey,
        distributorATA,
        signer,
        BigInt(maxTotalClaim),
        [],
        { commitment }
      );
    });

    it("claim deep node", async () => {
      const amount = new BN(100);
      const index = 90000;
      const claimant = investors[index];
      const proof = tree.getProof(index, claimant.publicKey, amount);
      const claimantATA = await mintHelper.createAssociatedTokenAccount(
        claimant.publicKey,
        signer,
        false
      );
      const proofBytes = proof.map((p) => toBytes32Array(p));
      const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("ClaimStatus"),
          new BN(index).toArrayLike(Buffer, "le", 8),
          distributor.toBytes(),
        ],
        dividendsProgram.programId
      );

      const signature = await dividendsProgram.methods
        .claim(claimBump, new BN(index), amount, proofBytes)
        .accountsStrict({
          distributor,
          claimStatus: claimPubkey,
          from: distributorATA,
          to: claimantATA,
          claimant: claimant.publicKey,
          payer: signer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimant, signer])
        .rpc({ commitment });
      const computeUnits = await getTransactionComputeUnits(
        connection,
        signature,
        commitment
      );
      assert.isAtMost(computeUnits, 200000);
    });

    it("claims random distribution", async () => {
      const amount = new BN(100);
      for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
        const claimant = investors[i];
        const proof = tree.getProof(i, claimant.publicKey, amount);
        const claimantATA = await mintHelper.createAssociatedTokenAccount(
          claimant.publicKey,
          signer,
          false
        );
        const proofBytes = proof.map((p) => toBytes32Array(p));
        const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
          [
            utils.bytes.utf8.encode("ClaimStatus"),
            new BN(i).toArrayLike(Buffer, "le", 8),
            distributor.toBytes(),
          ],
          dividendsProgram.programId
        );

        const signature = await dividendsProgram.methods
          .claim(claimBump, new BN(i), amount, proofBytes)
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant: claimant.publicKey,
            payer: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([claimant, signer])
          .rpc({ commitment });

        const computeUnits = await getTransactionComputeUnits(
          connection,
          signature,
          commitment
        );
        assert.isAtMost(computeUnits, 200000);
      }
    });
  });
});
