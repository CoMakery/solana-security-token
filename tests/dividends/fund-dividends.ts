import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import {
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MintHelper } from "../helpers/mint_helper";
import { solToLamports, topUpWallet } from "../utils";
import { toBytes32Array } from "../../app/src/merkle-distributor/utils";
import { createDistributor } from "./utils";

type TestCase = {
  tokenProgramId: PublicKey;
  programName: string;
};

const testCases: TestCase[] = [
  { tokenProgramId: TOKEN_PROGRAM_ID, programName: "SPL Token" },
  { tokenProgramId: TOKEN_2022_PROGRAM_ID, programName: "SPL Token 2022" },
];

testCases.forEach(({ tokenProgramId, programName }) => {
  describe(`fund dividends for ${programName}`, () => {
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
      ({ mintKeypair, mintHelper, baseKey, distributor, bump, distributorATA } =
        await createDistributor(
          connection,
          decimals,
          signer,
          dividendsProgram.programId,
          tokenProgramId,
          commitment
        ));
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

    context("fundDividends", () => {
      const root = ZERO_BYTES32;
      const maxTotalClaim = MAX_TOTAL_CLAIM;
      const maxNumNodes = MAX_NUM_NODES;
      let funderKP: Keypair;
      let funderATA: PublicKey;

      beforeEach(async () => {
        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(root),
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
        funderKP = Keypair.generate();
        funderATA = await mintHelper.createAssociatedTokenAccount(
          funderKP.publicKey,
          signer,
          false
        );
        await mintTo(
          connection,
          signer,
          mintKeypair.publicKey,
          funderATA,
          signer,
          BigInt(MAX_TOTAL_CLAIM.muln(2).toString()),
          [],
          { commitment },
          tokenProgramId
        );
      });

      it("fails for zero amount", async () => {
        const fundingAmount = new BN(0);
        try {
          await dividendsProgram.methods
            .fundDividends(fundingAmount)
            .accountsStrict({
              distributor,
              mint: mintKeypair.publicKey,
              from: funderATA,
              to: distributorATA,
              funder: funderKP.publicKey,
              payer: signer.publicKey,
              tokenProgram: tokenProgramId,
            })
            .signers([funderKP, signer])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch ({ error }) {
          assert.equal(error.errorCode.code, "InvalidFundingAmount");
          assert.equal(error.errorMessage, "Invalid funding amount");
        }
      });

      it("fails for amount greater than max total claim", async () => {
        const fundingAmount = maxTotalClaim.addn(1);
        try {
          await dividendsProgram.methods
            .fundDividends(fundingAmount)
            .accountsStrict({
              distributor,
              mint: mintKeypair.publicKey,
              from: funderATA,
              to: distributorATA,
              funder: funderKP.publicKey,
              payer: signer.publicKey,
              tokenProgram: tokenProgramId,
            })
            .signers([funderKP, signer])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch ({ error }) {
          assert.equal(error.errorCode.code, "InvalidFundingAmount");
          assert.equal(error.errorMessage, "Invalid funding amount");
        }
      });

      it("fails when sum of funding amount greater than max total claim", async () => {
        const fundingAmount = maxTotalClaim;

        await dividendsProgram.methods
          .fundDividends(fundingAmount)
          .accountsStrict({
            distributor,
            mint: mintKeypair.publicKey,
            from: funderATA,
            to: distributorATA,
            funder: funderKP.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([funderKP, signer])
          .rpc({ commitment });

        try {
          await dividendsProgram.methods
            .fundDividends(new BN(1))
            .accountsStrict({
              distributor,
              mint: mintKeypair.publicKey,
              from: funderATA,
              to: distributorATA,
              funder: funderKP.publicKey,
              payer: signer.publicKey,
              tokenProgram: tokenProgramId,
            })
            .signers([funderKP, signer])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch ({ error }) {
          assert.equal(error.errorCode.code, "InvalidFundingAmount");
          assert.equal(error.errorMessage, "Invalid funding amount");
        }
      });

      it("fails for distributor with different mint", async () => {
        const fundingAmount = new BN(1);
        const invalidDistributor = Keypair.generate().publicKey;

        const {
          mintKeypair: anotherMintKeypair,
          mintHelper: anotherMintHelper,
          baseKey: anotherBaseKey,
          distributor: anotherDistributor,
          bump: anotherBump,
          distributorATA: anotherDistributorATA,
        } = await createDistributor(
          connection,
          decimals,
          signer,
          dividendsProgram.programId,
          tokenProgramId,
          commitment
        );

        await dividendsProgram.methods
          .newDistributor(
            anotherBump,
            toBytes32Array(root),
            maxTotalClaim,
            maxNumNodes
          )
          .accountsStrict({
            base: anotherBaseKey.publicKey,
            distributor: anotherDistributor,
            mint: anotherMintKeypair.publicKey,
            payer: signer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([signer, anotherBaseKey])
          .rpc({ commitment });

        try {
          await dividendsProgram.methods
            .fundDividends(fundingAmount)
            .accountsStrict({
              distributor: anotherDistributor,
              mint: mintKeypair.publicKey,
              from: funderATA,
              to: distributorATA,
              funder: funderKP.publicKey,
              payer: signer.publicKey,
              tokenProgram: tokenProgramId,
            })
            .signers([funderKP, signer])
            .rpc({ commitment });
          assert.fail("Expected an error");
        } catch ({ error }) {
          assert.equal(error.errorCode.code, "ConstraintAddress");
          assert.equal(
            error.errorMessage,
            "An address constraint was violated"
          );
        }
      });

      it("funds dividends", async () => {
        const fundingAmount = maxTotalClaim;
        const funderATADataBefore = await mintHelper.getAccount(funderATA);
        const distributorATADataBefore = await mintHelper.getAccount(
          distributorATA
        );

        await dividendsProgram.methods
          .fundDividends(fundingAmount)
          .accountsStrict({
            distributor,
            mint: mintKeypair.publicKey,
            from: funderATA,
            to: distributorATA,
            funder: funderKP.publicKey,
            payer: signer.publicKey,
            tokenProgram: tokenProgramId,
          })
          .signers([funderKP, signer])
          .rpc({ commitment });

        const funderATADataAfter = await mintHelper.getAccount(funderATA);
        const distributorATADataAfter = await mintHelper.getAccount(
          distributorATA
        );

        assert.equal(
          funderATADataBefore.amount,
          funderATADataAfter.amount + BigInt(fundingAmount.toString())
        );
        assert.equal(
          distributorATADataBefore.amount,
          distributorATADataAfter.amount - BigInt(fundingAmount.toString())
        );
      });
    });
  });
});
