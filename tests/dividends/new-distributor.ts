import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { solToLamports, topUpWallet } from "../utils";
import {
  toBytes32Array,
} from "../../app/src/merkle-distributor/utils";
import { createDistributor } from "./utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Roles } from "../helpers/access-control_helper";

type TestCase = {
  tokenProgramId: PublicKey;
  programName: string;
};

const testCases: TestCase[] = [
  { tokenProgramId: TOKEN_PROGRAM_ID, programName: "SPL Token" },
  { tokenProgramId: TOKEN_2022_PROGRAM_ID, programName: "SPL Token 2022" },
];

testCases.forEach(({ tokenProgramId, programName }) => {
  describe(`claim-dividends for ${programName}`, () => {
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
    let signer;
    const root = ZERO_BYTES32;
    const maxTotalClaim = MAX_TOTAL_CLAIM;
    const maxNumNodes = MAX_NUM_NODES;

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
      ({ mintKeypair, baseKey, distributor, bump } = await createDistributor(
        connection,
        decimals,
        signer,
        dividendsProgram.programId,
        tokenProgramId,
        commitment
      ));
    });

    it("initializes new distributor", async () => {
      await dividendsProgram.methods
        .newDistributor(bump, toBytes32Array(root), maxTotalClaim, maxNumNodes)
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

    it("fails to initialize new distributor without contract admin role", async () => {
      const wallet = Keypair.generate();
      const [walletRole] = testEnvironment.accessControlHelper.walletRolePDA(
        wallet.publicKey
      );
      await testEnvironment.accessControlHelper.initializeWalletRole(
        wallet.publicKey,
        Roles.ReserveAdmin | Roles.TransferAdmin | Roles.WalletsAdmin,
        testEnvironment.contractAdmin
      );
      await topUpWallet(connection, wallet.publicKey, solToLamports(1));

      try {
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
            authorityWalletRole: walletRole,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([wallet, baseKey])
          .rpc({ commitment });
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "Unauthorized");
        assert.equal(
          error.errorMessage,
          "Account is not authorized to execute this instruction"
        );
      }
    });
  });
});