import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram, Keypair } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Revoke holder group", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  const groupId = new anchor.BN(1);
  let groupPubkey: anchor.web3.PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    const [transferAdminRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      groupId,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupId);
    let holderIdx = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    let [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    let [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    holderIdx = holderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );

    holderIdx = holderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      holderIdx,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
    [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      groupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin
    );
  });

  it("fails to revoke holder group by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolderGroup()
        .accountsStrict({
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to revoke holder group by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolderGroup()
        .accountsStrict({
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("revokes holder group by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(0)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolderGroup()
      .accountsStrict({
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNull(accountInfo);
  });

  it("revokes holder group by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(1)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .revokeHolderGroup()
      .accountsStrict({
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNull(accountInfo);
  });

  const investor = Keypair.generate();
  it("fails to revoke holder group if some wallets are linked with it", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(
      new anchor.BN(2)
    );
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        groupId
      );
    let accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);

    const investorTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        testEnvironment.transferAdmin
      );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      holderPubkey,
      holderGroupPubkey,
      investor.publicKey,
      investorTokenAccount,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .revokeHolderGroup()
        .accountsStrict({
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "CurrentWalletsCountMustBeZero");
      assert.equal(error.errorMessage, "Current wallets count must be zero");
    }
    accountInfo = await testEnvironment.connection.getAccountInfo(
      holderGroupPubkey
    );
    assert.isNotNull(accountInfo);
  });
});
