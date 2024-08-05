import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Initialize security associated account", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
  };
  let testEnvironment: TestEnvironment;
  const firstGroupIdx = new anchor.BN(1);
  let firstGroupPubkey: PublicKey;
  const investorWallet1 = Keypair.generate();
  let investorWallet1AssociatedAccount: PublicKey;
  const investorWallet2 = Keypair.generate();
  let investorWallet2AssociatedAccount: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.transferAdmin.publicKey)[0],
      testEnvironment.transferAdmin,
    );
    [firstGroupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    let currentHolderIdx = new anchor.BN(0);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.walletsAdmin.publicKey)[0],
      testEnvironment.walletsAdmin,
    );
    const [transferAdminRole] = testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.transferAdmin.publicKey);
    let [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx)
    let [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    )
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin,
    );
    currentHolderIdx = currentHolderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.walletsAdmin.publicKey)[0],
      testEnvironment.walletsAdmin,
    );
    [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
    [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin,
    );
    currentHolderIdx = currentHolderIdx.addn(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      currentHolderIdx,
      testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.walletsAdmin.publicKey)[0],
      testEnvironment.walletsAdmin,
    );
    [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(currentHolderIdx);
    [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      holderGroupPubkey,
      holderPubkey,
      firstGroupPubkey,
      transferAdminRole,
      testEnvironment.transferAdmin,
    );

    investorWallet1AssociatedAccount = await testEnvironment.mintHelper.createAssociatedTokenAccount(
      investorWallet1.publicKey,
      testEnvironment.reserveAdmin
    );
    investorWallet2AssociatedAccount = await testEnvironment.mintHelper.createAssociatedTokenAccount(
      investorWallet2.publicKey,
      testEnvironment.reserveAdmin
    );
  });

  it("fails to initialize security associated account by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] = testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(investorWallet1AssociatedAccount);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
          userWallet: investorWallet1.publicKey,
          associatedTokenAccount: investorWallet1AssociatedAccount,
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

  it("fails to initialize security associated account by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] = testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(investorWallet1AssociatedAccount);
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: securityAssociatedAccountPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          holderGroup: holderGroupPubkey,
          securityToken: testEnvironment.mintKeypair.publicKey,
          transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
          userWallet: investorWallet1.publicKey,
          associatedTokenAccount: investorWallet1AssociatedAccount,
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

  it("initializes security associated account by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const holderIdx = new anchor.BN(0);
    const [authorityWalletRolePubkey] = testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      investorWallet1AssociatedAccount
    );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    const { currentWalletsCount: currWalletsCountBeforePerGroup } = await testEnvironment.transferRestrictionsHelper.holderGroupData(holderGroupPubkey);
    const { currentWalletsCount: currWalletsCountBeforePerHolder } = await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
        userWallet: investorWallet1.publicKey,
        associatedTokenAccount: investorWallet1AssociatedAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const securityAssociatedAccountData = await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(securityAssociatedAccountPubkey);
    assert.equal(securityAssociatedAccountData.group.toNumber(), firstGroupIdx.toNumber());
    assert.equal(securityAssociatedAccountData.holder.toBase58(), holderPubkey.toBase58());
    const { currentWalletsCount: currWalletsCountAfterPerGroup } = await testEnvironment.transferRestrictionsHelper.holderGroupData(holderGroupPubkey);
    const { currentWalletsCount: currWalletsCountAfterPerHolder } = await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(currWalletsCountAfterPerGroup.toNumber(), currWalletsCountBeforePerGroup.toNumber() + 1);
    assert.equal(currWalletsCountAfterPerHolder.toNumber(), currWalletsCountBeforePerHolder.toNumber() + 1);
  });

  it("initializes security associated account by wallets admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const holderIdx = new anchor.BN(1);
    const [authorityWalletRolePubkey] = testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [securityAssociatedAccountPubkey] = testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
      investorWallet2AssociatedAccount
    );
    const [holderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [holderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      holderPubkey,
      firstGroupIdx,
    );
    const { currentWalletsCount: currWalletsCountBeforePerGroup } = await testEnvironment.transferRestrictionsHelper.holderGroupData(holderGroupPubkey);
    const { currentWalletsCount: currWalletsCountBeforePerHolder } = await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: testEnvironment.mintKeypair.publicKey,
        transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
        userWallet: investorWallet2.publicKey,
        associatedTokenAccount: investorWallet2AssociatedAccount,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const securityAssociatedAccountData = await testEnvironment.transferRestrictionsHelper.securityAssociatedAccountData(securityAssociatedAccountPubkey);
    assert.equal(securityAssociatedAccountData.group.toNumber(), firstGroupIdx.toNumber());
    assert.equal(securityAssociatedAccountData.holder.toBase58(), holderPubkey.toBase58());
    const { currentWalletsCount: currWalletsCountAfterPerGroup } = await testEnvironment.transferRestrictionsHelper.holderGroupData(holderGroupPubkey);
    const { currentWalletsCount: currWalletsCountAfterPerHolder } = await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.equal(currWalletsCountAfterPerGroup.toNumber(), currWalletsCountBeforePerGroup.toNumber() + 1);
    assert.equal(currWalletsCountAfterPerHolder.toNumber(), currWalletsCountBeforePerHolder.toNumber() + 1);
  });
});
