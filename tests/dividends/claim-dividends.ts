import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN, utils } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { createMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MintHelper } from "../helpers/mint_helper";
import { solToLamports, topUpWallet } from "../utils";
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

  const MAX_NUM_NODES = new BN(3);
  const MAX_TOTAL_CLAIM = new BN(1_000_000_000_000);
  const ZERO_BYTES32 = Buffer.alloc(32);
  let distributor: PublicKey;
  let bump: number;
  let baseKey: Keypair;
  let mintHelper: MintHelper;
  let distributorATA: PublicKey;
  const signer = Keypair.generate();

  beforeEach(async () => {
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
  });

  it("Is initialized!", async () => {
    const root = ZERO_BYTES32;
    const maxTotalClaim = MAX_TOTAL_CLAIM;
    const maxNumNodes = MAX_NUM_NODES;

    await dividendsProgram.methods
      .newDistributor(bump, toBytes32Array(root), maxTotalClaim, maxNumNodes)
      .accountsStrict({
        base: baseKey.publicKey,
        distributor,
        mint: mintKeypair.publicKey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer, baseKey])
      .rpc({ commitment });

    const distributorData =
      await dividendsProgram.account.merkleDistributor.fetch(distributor);
    assert.equal(distributorData.bump, bump);
    assert.equal(
      distributorData.maxNumNodes.toString(),
      MAX_NUM_NODES.toString()
    );
    assert.equal(
      distributorData.maxTotalClaim.toString(),
      MAX_TOTAL_CLAIM.toString()
    );
    assert.deepEqual(distributorData.base, baseKey.publicKey);
    assert.deepEqual(distributorData.mint, mintKeypair.publicKey);
    assert.equal(distributorData.numNodesClaimed.toNumber(), 0);
    assert.deepEqual(
      distributorData.root,
      Array.from(new Uint8Array(ZERO_BYTES32))
    );
    assert.equal(distributorData.totalAmountClaimed.toNumber(), 0);
  });

  context("claim", () => {
    it("fails for empty proof", async () => {
      const root = ZERO_BYTES32;
      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(bump, toBytes32Array(root), maxTotalClaim, maxNumNodes)
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: mintKeypair.publicKey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer, baseKey])
        .rpc({ commitment });

      const claimantKP = Keypair.generate();
      const index = new BN(0);
      const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("ClaimStatus"),
          index.toArrayLike(Buffer, "le", 8),
          distributor.toBytes(),
        ],
        dividendsProgram.programId
      );

      const claimAmount = new BN(1_000_000);
      const claimantATA = await mintHelper.createAssociatedTokenAccount(
        claimantKP.publicKey,
        signer,
        false
      );
      try {
        await dividendsProgram.methods
          .claim(claimBump, index, claimAmount, [])
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant: claimantKP.publicKey,
            payer: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([claimantKP, signer])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "InvalidProof");
        assert.equal(error.errorMessage, "Invalid Merkle proof");
      }
    });

    it("success on three account tree", async () => {
      const kpOne = Keypair.generate();
      const kpTwo = Keypair.generate();
      const kpThree = Keypair.generate();
      const allKps = [kpOne, kpTwo, kpThree];
      await Promise.all(
        allKps.map(async (kp) => {
          await topUpWallet(connection, kp.publicKey, solToLamports(1));
        })
      );

      const claimAmountOne = new BN(100);
      const claimAmountTwo = new BN(101);
      const claimAmountThree = new BN(102);
      const tree = new BalanceTree([
        { account: kpOne.publicKey, amount: claimAmountOne },
        { account: kpTwo.publicKey, amount: claimAmountTwo },
        { account: kpThree.publicKey, amount: claimAmountThree },
      ]);

      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          maxTotalClaim,
          maxNumNodes
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
        BigInt(MAX_TOTAL_CLAIM.toString()),
        [],
        { commitment }
      );

      await Promise.all(
        allKps.map(async (kp, index) => {
          const amount = new BN(100 + index);
          const proof = tree.getProof(index, kp.publicKey, amount);
          const claimantATA = await mintHelper.createAssociatedTokenAccount(
            kp.publicKey,
            signer,
            false
          );

          const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
            [
              utils.bytes.utf8.encode("ClaimStatus"),
              new BN(index).toArrayLike(Buffer, "le", 8),
              distributor.toBytes(),
            ],
            dividendsProgram.programId
          );
          const proofBytes = proof.map((p) => toBytes32Array(p));

          await dividendsProgram.methods
            .claim(claimBump, new BN(index), amount, proofBytes)
            .accountsStrict({
              distributor,
              claimStatus: claimPubkey,
              from: distributorATA,
              to: claimantATA,
              claimant: kp.publicKey,
              payer: signer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([kp, signer])
            .rpc({ commitment });

          const tokenAccountInfo = await mintHelper.getAccount(claimantATA);
          assert.equal(tokenAccountInfo.amount.toString(), amount.toString());

          const claimStatusData =
            await dividendsProgram.account.claimStatus.fetch(claimPubkey);
          assert.equal(claimStatusData.isClaimed, true);
          assert.deepEqual(claimStatusData.claimant, kp.publicKey);
          assert.equal(claimStatusData.amount.toString(), amount.toString());
        })
      );

      const expectedTotalClaimed = claimAmountOne
        .add(claimAmountTwo)
        .add(claimAmountThree);
      const tokenAccountInfo = await mintHelper.getAccount(distributorATA);
      assert.equal(
        tokenAccountInfo.amount.toString(),
        MAX_TOTAL_CLAIM.sub(expectedTotalClaimed).toString()
      );

      const distributorData =
        await dividendsProgram.account.merkleDistributor.fetch(distributor);
      assert.equal(distributorData.numNodesClaimed.toNumber(), allKps.length);
      assert.equal(
        distributorData.totalAmountClaimed.toString(),
        expectedTotalClaimed.toString()
      );
    });

    it("cannot allow two claims", async () => {
      const userKP = Keypair.generate();
      await topUpWallet(connection, userKP.publicKey, solToLamports(1));

      const claimAmount = new BN(1_000_000);
      const tree = new BalanceTree([
        { account: userKP.publicKey, amount: claimAmount },
      ]);
      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          maxTotalClaim,
          maxNumNodes
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
        BigInt(MAX_TOTAL_CLAIM.toString()),
        [],
        { commitment }
      );

      const index = new BN(0);
      const proof = tree.getProof(
        index.toNumber(),
        userKP.publicKey,
        claimAmount
      );
      const claimantATA = await mintHelper.createAssociatedTokenAccount(
        userKP.publicKey,
        signer,
        false
      );

      const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("ClaimStatus"),
          new BN(index).toArrayLike(Buffer, "le", 8),
          distributor.toBytes(),
        ],
        dividendsProgram.programId
      );
      const proofBytes = proof.map((p) => toBytes32Array(p));

      await dividendsProgram.methods
        .claim(claimBump, new BN(index), claimAmount, proofBytes)
        .accountsStrict({
          distributor,
          claimStatus: claimPubkey,
          from: distributorATA,
          to: claimantATA,
          claimant: userKP.publicKey,
          payer: signer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKP, signer])
        .rpc({ commitment });

      try {
        await dividendsProgram.methods
          .claim(claimBump, new BN(index), claimAmount, proofBytes)
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant: userKP.publicKey,
            payer: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userKP, signer])
          .rpc({ commitment });
        assert.fail("Expected an error");
      } catch (error) {
        const isExpectedError = error.logs.some((log: string) => {
          return (
            log ===
            `Allocate: account Address { address: ${claimPubkey.toString()}, base: None } already in use`
          );
        });
        assert.isTrue(isExpectedError);
      }
    });

    it("cannot claim more than proof", async () => {
      const userKP = Keypair.generate();
      await topUpWallet(connection, userKP.publicKey, solToLamports(1));

      const claimAmount = new BN(1_000_000);
      const tree = new BalanceTree([
        { account: userKP.publicKey, amount: new BN(1_000_000) },
      ]);
      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          maxTotalClaim,
          maxNumNodes
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
        BigInt(MAX_TOTAL_CLAIM.toString()),
        [],
        { commitment }
      );

      const index = new BN(0);
      const proof = tree.getProof(
        index.toNumber(),
        userKP.publicKey,
        claimAmount
      );
      const claimantATA = await mintHelper.createAssociatedTokenAccount(
        userKP.publicKey,
        signer,
        false
      );
      const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("ClaimStatus"),
          new BN(index).toArrayLike(Buffer, "le", 8),
          distributor.toBytes(),
        ],
        dividendsProgram.programId
      );
      const proofBytes = proof.map((p) => toBytes32Array(p));

      try {
        await dividendsProgram.methods
          .claim(claimBump, new BN(index), claimAmount.addn(1), proofBytes)
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant: userKP.publicKey,
            payer: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userKP, signer])
          .rpc({ commitment });
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "InvalidProof");
        assert.equal(error.errorMessage, "Invalid Merkle proof");
      }
    });

    it("cannot claim for address other than proof", async () => {
      const claimant = Keypair.generate().publicKey;
      const rogueKP = Keypair.generate();
      await topUpWallet(connection, rogueKP.publicKey, solToLamports(1));

      const claimAmount = new BN(1_000_000);
      const tree = new BalanceTree([
        { account: claimant, amount: claimAmount },
      ]);
      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          maxTotalClaim,
          maxNumNodes
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
        BigInt(MAX_TOTAL_CLAIM.toString()),
        [],
        { commitment }
      );

      const index = new BN(0);
      const proof = tree.getProof(index.toNumber(), claimant, claimAmount);
      const claimantATA = await mintHelper.createAssociatedTokenAccount(
        claimant,
        signer,
        false
      );
      const [claimPubkey, claimBump] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode("ClaimStatus"),
          new BN(index).toArrayLike(Buffer, "le", 8),
          distributor.toBytes(),
        ],
        dividendsProgram.programId
      );
      const proofBytes = proof.map((p) => toBytes32Array(p));

      try {
        await dividendsProgram.methods
          .claim(claimBump, new BN(index), claimAmount, proofBytes)
          .accountsStrict({
            distributor,
            claimStatus: claimPubkey,
            from: distributorATA,
            to: claimantATA,
            claimant,
            payer: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([rogueKP, signer])
          .rpc({ commitment });
      } catch (error) {
        assert.equal(
          error,
          `Error: unknown signer: ${rogueKP.publicKey.toString()}`
        );
      }
    });
  });
});
