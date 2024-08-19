import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Dividends } from "../../target/types/dividends";
import { mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { MintHelper } from "../helpers/mint_helper";
import { solToLamports, topUpWallet } from "../utils";
import {
  parseBalanceMap,
  toBytes32Array,
} from "../../app/src/merkle-distributor/utils";
import {
  findClaimStatusKey,
} from "../../app/src/merkle-distributor";
import { claim, createDistributor } from "./utils";

describe("parse BalanceMap", () => {
  const provider = AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);
  const commitment = "confirmed";

  const dividendsProgram = anchor.workspace.Dividends as Program<Dividends>;
  const decimals = 6;
  let mintKeypair: Keypair;

  const keypairs: Keypair[] = [
    Keypair.fromSeed(Uint8Array.from(Array(32).fill(0))),
    Keypair.fromSeed(Uint8Array.from(Array(32).fill(2))),
    Keypair.fromSeed(Uint8Array.from(Array(32).fill(1))),
  ];
  let claims: {
    [account: string]: {
      index: number;
      amount: BN;
      proof: Buffer[];
    };
  };

  let distributor: PublicKey;
  let bump: number;
  let baseKey: Keypair;
  let mintHelper: MintHelper;
  let distributorATA: PublicKey;
  const signer = Keypair.generate();

  before(async () => {
    await Promise.all(
      keypairs.map(async (kp) => {
        await topUpWallet(connection, kp.publicKey, solToLamports(1));
      })
    );

    const {
      claims: innerClaims,
      merkleRoot,
      tokenTotal,
    } = parseBalanceMap(
      keypairs.map((kp, i) => ({
        address: kp.publicKey.toString(),
        earnings: new BN("1000000").mul(new BN(i + 1)).toString(),
      }))
    );
    assert.equal(tokenTotal, "6000000");

    await topUpWallet(connection, signer.publicKey, solToLamports(10));

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
        toBytes32Array(merkleRoot),
        new BN(tokenTotal),
        new BN(keypairs.length)
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
      BigInt(tokenTotal),
      [],
      { commitment }
    );
    claims = innerClaims;
  });

  it("check the proofs is as expected", () => {
    assert.isNotNull(keypairs[0]);
    assert.isNotNull(keypairs[1]);
    assert.isNotNull(keypairs[2]);

    assert.deepEqual(claims, {
      [keypairs[0].publicKey.toString()]: {
        index: 0,
        amount: new BN("1000000"),
        proof: [
          Buffer.from(
            "607e67765bcf4177e16fccd6149a4cfcd05d291ab664d24b8f7455d08aa121af",
            "hex"
          ),
        ],
      },
      [keypairs[1].publicKey.toString()]: {
        index: 1,
        amount: new BN("2000000"),
        proof: [
          Buffer.from(
            "0e21270c3d6d0301cce89f02f6b1c0728836b240263eb18026a7e8f0888d1cb3",
            "hex"
          ),
          Buffer.from(
            "57a5e990a9233980bbf1b2bb45484b8f6d374116fb20de4044f4d57fc0ab512b",
            "hex"
          ),
        ],
      },
      [keypairs[2].publicKey.toString()]: {
        index: 2,
        amount: new BN("3000000"),
        proof: [
          Buffer.from(
            "064d3da266f8756627ec7afda54dbfa8ac806030d2092b193840dfc392486468",
            "hex"
          ),
          Buffer.from(
            "57a5e990a9233980bbf1b2bb45484b8f6d374116fb20de4044f4d57fc0ab512b",
            "hex"
          ),
        ],
      },
    });
  });

  it("all claims work exactly once", async () => {
    await Promise.all(
      keypairs.map(async (claimantKP) => {
        const claimantPubkey = claimantKP.publicKey;
        const claimInfo = claims[claimantPubkey.toString()];
        assert.isNotNull(claimInfo, "claim must exist");
        const index = new BN(claimInfo.index);
        const [claimPubkey, claimBump] = findClaimStatusKey(
          new BN(index),
          distributor,
          dividendsProgram.programId
        );

        await claim(
          dividendsProgram,
          index,
          claimInfo.amount,
          claimInfo.proof,
          claimantKP,
          distributor,
          mintHelper,
          signer,
          commitment
        );

        const claimStatusData =
          await dividendsProgram.account.claimStatus.fetch(claimPubkey);
        assert.equal(claimStatusData.isClaimed, true);
        assert.deepEqual(claimStatusData.claimant, claimantPubkey);
        assert.equal(
          claimStatusData.amount.toString(),
          claimInfo.amount.toString()
        );

        try {
          await claim(
            dividendsProgram,
            index,
            claimInfo.amount,
            claimInfo.proof,
            claimantKP,
            distributor,
            mintHelper,
            signer,
            commitment
          );
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
      })
    );
  });
});
