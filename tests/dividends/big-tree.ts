import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
import { claim, createDistributor } from "./utils";
import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("big tree", () => {
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
  const ipfsHash =
    "QmQ9Q5Q6Q7Q8Q9QaQbQcQdQeQfQgQhQiQjQkQlQmQnQoQpQqQrQsQtQuQvQwQxQy";

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
    let signer: Keypair;
    const totalClaimAmount = 100 * NUM_LEAVES;
    let signerATA: PublicKey;

    before(async () => {
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
          TOKEN_PROGRAM_ID,
          commitment
        ));

      await dividendsProgram.methods
        .newDistributor(
          bump,
          toBytes32Array(tree.getRoot()),
          new BN(totalClaimAmount),
          new BN(NUM_LEAVES),
          ipfsHash
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

      signerATA = await mintHelper.createAssociatedTokenAccount(
        signer.publicKey,
        signer
      );
      await mintTo(
        connection,
        signer,
        mintKeypair.publicKey,
        signerATA,
        signer,
        BigInt(totalClaimAmount.toString()),
        [],
        { commitment },
        TOKEN_PROGRAM_ID
      );
      await dividendsProgram.methods
        .fundDividends(new BN(totalClaimAmount))
        .accounts({
          distributor,
          mint: mintKeypair.publicKey,
          from: signerATA,
          to: distributorATA,
          funder: signer.publicKey,
          payer: signer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment });
    });

    it("claim deep node", async () => {
      const amount = new BN(100);
      const index = 90000;
      const claimant = investors[index];
      const proof = tree.getProof(index, claimant.publicKey, amount);

      const signature = await claim(
        dividendsProgram,
        new BN(index),
        amount,
        proof,
        claimant,
        distributor,
        mintHelper,
        signer
      );

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

        const signature = await claim(
          dividendsProgram,
          new BN(i),
          amount,
          proof,
          claimant,
          distributor,
          mintHelper,
          signer
        );

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
