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
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

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

    const NUM_NODES = new BN(3);
    const TOTAL_CLAIM_AMOUNT = new BN(1_000_000_000_000);
    const ZERO_BYTES32 = Buffer.alloc(32);
    let distributor: PublicKey;
    let bump: number;
    let baseKey: Keypair;
    let mintHelper: MintHelper;
    let distributorATA: PublicKey;
    let signer: Keypair;

    const testEnvironmentParams: TestEnvironmentParams = {
      mint: {
        decimals: 6,
        name: "XYZ Token",
        symbol: "XYZ",
        uri: "https://example.com",
      },
      initialSupply: 1_000_000_000_000,
      maxHolders: 10000,
      maxTotalSupply: 100_000_000_000_000,
    };
    let testEnvironment: TestEnvironment;

    beforeEach(async () => {
      testEnvironment = new TestEnvironment(testEnvironmentParams);
      await testEnvironment.setupAccessControl();
      signer = testEnvironment.contractAdmin;

      await topUpWallet(connection, signer.publicKey, solToLamports(1));
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
      const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
      const numNodes = NUM_NODES;

      await dividendsProgram.methods
        .newDistributor(bump, toBytes32Array(root), totalClaimAmount, numNodes)
        .accountsStrict({
          base: baseKey.publicKey,
          distributor,
          mint: mintKeypair.publicKey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              signer.publicKey
            )[0],
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer, baseKey])
        .rpc({ commitment });

      const distributorData =
        await dividendsProgram.account.merkleDistributor.fetch(distributor);
      assert.equal(distributorData.bump, bump);
      assert.equal(distributorData.numNodes.toString(), NUM_NODES.toString());
      assert.equal(
        distributorData.totalClaimAmount.toString(),
        TOTAL_CLAIM_AMOUNT.toString()
      );
      assert.deepEqual(distributorData.base, baseKey.publicKey);
      assert.deepEqual(distributorData.mint, mintKeypair.publicKey);
      assert.equal(distributorData.numNodesClaimed.toNumber(), 0);
      assert.deepEqual(
        distributorData.root,
        Array.from(new Uint8Array(ZERO_BYTES32))
      );
      assert.equal(distributorData.totalAmountClaimed.toNumber(), 0);
      assert.isFalse(distributorData.readyToClaim);
    });

    context("fundDividends", () => {
      const root = ZERO_BYTES32;
      const totalClaimAmount = TOTAL_CLAIM_AMOUNT;
      const numNodes = NUM_NODES;
      let funderKP: Keypair;
      let funderATA: PublicKey;

      beforeEach(async () => {
        await dividendsProgram.methods
          .newDistributor(
            bump,
            toBytes32Array(root),
            totalClaimAmount,
            numNodes
          )
          .accountsStrict({
            base: baseKey.publicKey,
            distributor,
            mint: mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
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
          BigInt(TOTAL_CLAIM_AMOUNT.muln(2).toString()),
          [],
          { commitment },
          tokenProgramId
        );
      });

      it("fails for paused distribution", async () => {
        await dividendsProgram.methods
          .pause(true)
          .accountsStrict({
            distributor,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            authority: signer.publicKey,
          })
          .signers([signer])
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
          assert.equal(error.errorCode.code, "DistributionPaused");
          assert.equal(error.errorMessage, "Distribution is paused");
        }
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
        const fundingAmount = totalClaimAmount.addn(1);
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
        const fundingAmount = totalClaimAmount;

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

        const {
          mintKeypair: anotherMintKeypair,
          baseKey: anotherBaseKey,
          distributor: anotherDistributor,
          bump: anotherBump,
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
            totalClaimAmount,
            numNodes
          )
          .accountsStrict({
            base: anotherBaseKey.publicKey,
            distributor: anotherDistributor,
            mint: anotherMintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                signer.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
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

      it("ready to claim after fund dividends twice", async () => {
        const funderATADataBefore = await mintHelper.getAccount(funderATA);
        const distributorATADataBefore = await mintHelper.getAccount(
          distributorATA
        );

        const fundingAmountLeft = 1;
        const fundingAmount = totalClaimAmount.subn(fundingAmountLeft);
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
        const distributorATADataAfterFirstFund = await mintHelper.getAccount(
          distributorATA
        );
        assert.equal(
          distributorATADataBefore.amount,
          distributorATADataAfterFirstFund.amount -
            BigInt(fundingAmount.toString())
        );
        let distributorData =
          await dividendsProgram.account.merkleDistributor.fetch(distributor);
        assert.isFalse(distributorData.readyToClaim);

        await dividendsProgram.methods
          .fundDividends(new BN(fundingAmountLeft))
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
        const distributorATADataAfterSecondFund = await mintHelper.getAccount(
          distributorATA
        );
        distributorData =
          await dividendsProgram.account.merkleDistributor.fetch(distributor);
        assert.isTrue(distributorData.readyToClaim);
        assert.equal(
          funderATADataBefore.amount,
          funderATADataAfter.amount +
            BigInt(fundingAmountLeft) +
            BigInt(fundingAmount.toString())
        );
        assert.equal(
          distributorATADataAfterFirstFund.amount + BigInt(fundingAmountLeft),
          distributorATADataAfterSecondFund.amount
        );
      });

      it("funds dividends", async () => {
        const fundingAmount = totalClaimAmount;
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
        const distributorData =
          await dividendsProgram.account.merkleDistributor.fetch(distributor);

        assert.equal(
          funderATADataBefore.amount,
          funderATADataAfter.amount + BigInt(fundingAmount.toString())
        );
        assert.equal(
          distributorATADataBefore.amount,
          distributorATADataAfter.amount - BigInt(fundingAmount.toString())
        );
        assert.isTrue(distributorData.readyToClaim);
      });
    });
  });
});
