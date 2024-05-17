import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import { TransferRestrictions } from "../target/types/transfer_restrictions";
import { assert } from "chai";
import { topUpWallet } from "./utils";

const EXTRA_METAS_ACCOUNT_PREFIX = "extra-account-metas";
const ACCESS_CONTROL_PREFIX = "ac";
const WALLET_ROLE_PREFIX = "wallet_role";
const TRANSFER_RESTRICTION_GROUP_PREFIX = "trg";
const TRANSFER_RESTRICTION_DATA_PREFIX = "trd";
const TRANSFER_RULE_PREFIX = "tr";
const SECURITY_ASSOCIATED_ACCOUNT_PREFIX = "saa"; // security associated account
const TRANSFER_RESTRICTION_HOLDER_PREFIX = "trh"; // transfer_restriction_holder

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const confirmOptions = "confirmed";

  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;

  const superAdmin = Keypair.generate();

  const decimals = 6;
  const setupAccessControlArgs = {
    decimals,
    payer: superAdmin.publicKey,
    authority: superAdmin.publicKey,
    name: "XYZ Token",
    uri: "https://e.com",
    symbol: "XYZ",
    delegate: superAdmin.publicKey,
  };

  it("airdrop payer", async () => {
    console.log("Airdropping payer", superAdmin.publicKey.toString());

    await topUpWallet(
      provider.connection,
      superAdmin.publicKey,
      100000000000000
    );
  });

  it("Security Token with Transfer Restriction happy path", async () => {
    // Size of Mint Account with extension
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const mintKeypair = Keypair.generate();

    const balance = await provider.connection.getBalance(superAdmin.publicKey);
    console.log("Payer balance", balance);
    console.log("mintKeypair.publicKey:", mintKeypair.publicKey.toBase58());
    const [extraMetasAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(EXTRA_METAS_ACCOUNT_PREFIX),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );

    const [accessControlPubkey, accessControlBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode(ACCESS_CONTROL_PREFIX),
          mintKeypair.publicKey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Access Control Pubkey", accessControlPubkey.toBase58());
    console.log(
      "transferRestrictionsProgram.programId",
      transferRestrictionsProgram.programId.toBase58()
    );

    const [authorityWalletRolePubkey, walletRoleBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(WALLET_ROLE_PREFIX),
          mintKeypair.publicKey.toBuffer(),
          setupAccessControlArgs.authority.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Wallet Role Pubkey", authorityWalletRolePubkey.toBase58());

    // 1. Initialize Access Control and Mint
    console.log("1. Initialize Access Control and Mint");
    const tx = await transferRestrictionsProgram.methods
      .initializeAccessControl({
        decimals: setupAccessControlArgs.decimals,
        name: setupAccessControlArgs.name,
        symbol: setupAccessControlArgs.symbol,
        uri: setupAccessControlArgs.uri,
        delegate: setupAccessControlArgs.delegate
          ? new anchor.web3.PublicKey(setupAccessControlArgs.delegate)
          : null,
      })
      .accountsStrict({
        payer: setupAccessControlArgs.payer,
        authority: setupAccessControlArgs.authority,
        mint: mintKeypair.publicKey,
        accessControl: accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        extraMetasAccount: extraMetasAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([mintKeypair, superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log("InitializeAccessControl transaction signature", tx);

    const accessControlData =
      await transferRestrictionsProgram.account.accessControl.fetch(
        accessControlPubkey,
        confirmOptions
      );
    assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);

    const walletRoleData =
      await transferRestrictionsProgram.account.walletRole.fetch(
        authorityWalletRolePubkey
      );
    assert.deepEqual(walletRoleData.role, 15);

    let mintData = await getMint(
      connection,
      mintKeypair.publicKey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.deepEqual(mintData.mintAuthority, accessControlPubkey);
    assert.deepEqual(mintData.supply, BigInt(0));
    assert.deepEqual(mintData.decimals, decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(mintData.freezeAuthority, accessControlPubkey);

    // 2. Mint tokens to new account
    console.log("2. Mint tokens to new account");
    const userWallet = Keypair.generate();
    const userWalletPubkey = userWallet.publicKey;

    const userWalletAssociatedAccountPubkey = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userWalletPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(
      "New Associated Account Pubkey",
      userWalletAssociatedAccountPubkey.toBase58()
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        superAdmin.publicKey,
        userWalletAssociatedAccountPubkey,
        userWalletPubkey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const txCreateAssTokenAccount = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [superAdmin],
      { commitment: confirmOptions }
    );
    console.log(
      "Create Associated Token Account Transaction Signature",
      txCreateAssTokenAccount
    );

    const mintAmount = new anchor.BN(1000000);
    const mintTx = await transferRestrictionsProgram.methods
      .mintSecurities(mintAmount)
      .accountsStrict({
        authority: superAdmin.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: accessControlPubkey,
        securityMint: mintKeypair.publicKey,
        destinationAccount: userWalletAssociatedAccountPubkey,
        destinationAuthority: userWalletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log("Mint Securities Transaction Signature", mintTx);

    mintData = await getMint(
      connection,
      mintKeypair.publicKey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(mintData.supply.toString(), mintAmount.toString());

    const assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.amount.toString(), mintAmount.toString());

    // 3. Burn tokens
    console.log("3. Burn tokens");
    const burnAmount = new anchor.BN(700000);
    const burnTx = await transferRestrictionsProgram.methods
      .burnSecurities(burnAmount)
      .accountsStrict({
        authority: superAdmin.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: accessControlPubkey,
        securityMint: mintKeypair.publicKey,
        targetAccount: userWalletAssociatedAccountPubkey,
        targetAuthority: userWalletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log("Burn Securities Transaction Signature", burnTx);

    mintData = await getMint(
      connection,
      mintKeypair.publicKey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(
      mintData.supply.toString(),
      mintAmount.sub(burnAmount).toString()
    );

    // === TRANSFER RESTRICTIONS SETUP ===
    // 4. Create Transfer Restriction Data
    console.log("4. Creating Transfer Restriction Data");
    const maxHolders = new anchor.BN(10000);
    const [transferRestrictionDataPubkey, transferRestrictionDataBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RESTRICTION_DATA_PREFIX),
          mintKeypair.publicKey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Transfer Restriction Data Pubkey",
      transferRestrictionDataPubkey.toBase58()
    );
    const initTransferRestrictionDataTx =
      await transferRestrictionsProgram.methods
        .initializeTransferRestrictionsData(maxHolders)
        .accountsStrict({
          transferRestrictionData: transferRestrictionDataPubkey,
          accessControlAccount: accessControlPubkey,
          mint: mintKeypair.publicKey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Transfer Restrictions Data Transaction Signature",
      initTransferRestrictionDataTx
    );

    const transferRestrictionData =
      await transferRestrictionsProgram.account.transferRestrictionData.fetch(
        transferRestrictionDataPubkey
      );
    assert.deepEqual(
      transferRestrictionData.securityTokenMint,
      mintKeypair.publicKey
    );
    assert.deepEqual(
      transferRestrictionData.accessControlAccount,
      accessControlPubkey
    );
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(
      transferRestrictionData.maxHolders.toString(),
      maxHolders.toString()
    );

    // 5. Create Transfer Group 1
    console.log("5. Create Transfer Group 1");
    const transferGroup = new anchor.BN(1);
    const [transferRestrictionGroupPubkey, transferRestrictionGroupBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RESTRICTION_GROUP_PREFIX),
          transferRestrictionDataPubkey.toBuffer(),
          transferGroup.toArrayLike(Buffer, "le", 8),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Transfer Restriction Group Pubkey",
      transferRestrictionGroupPubkey.toBase58()
    );
    const initTransferGroupTx = await transferRestrictionsProgram.methods
      .initializeTransferRestrictionGroup(transferGroup)
      .accountsStrict({
        transferRestrictionGroup: transferRestrictionGroupPubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        payer: superAdmin.publicKey,
        accessControlAccount: accessControlPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Transfer Restriction Group Transaction Signature",
      initTransferGroupTx
    );
    const trGroupData =
      await transferRestrictionsProgram.account.transferRestrictionGroup.fetch(
        transferRestrictionGroupPubkey,
        confirmOptions
      );
    assert.equal(trGroupData.id.toString(), transferGroup.toString());
    assert.equal(trGroupData.maxHolders.toString(), maxHolders.toString());
    assert.equal(
      trGroupData.currentHoldersCount.toString(),
      Number(0).toString()
    );
    assert.deepEqual(
      trGroupData.transferRestrictionData,
      transferRestrictionDataPubkey
    );

    // 6. Create Transfer Rule 1 -> 1
    console.log("6. Create Transfer Rule 1 -> 1");
    const [transferRulePubkey, transferRulePubkeyBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RULE_PREFIX),
          transferRestrictionGroupPubkey.toBuffer(),
          transferRestrictionGroupPubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

    const tsNow = Date.now() / 1000;
    const lockedUntil = new anchor.BN(tsNow);
    // const lockedUntil = new anchor.BN(tsNow + 1000); // locked transfer rule
    const initTransferRuleTx = await transferRestrictionsProgram.methods
      .initializeTransferRule(lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: transferRestrictionGroupPubkey,
        transferRestrictionGroupTo: transferRestrictionGroupPubkey,
        accessControlAccount: accessControlPubkey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Transfer Rule Transaction Signature",
      initTransferRuleTx
    );

    const transferRuleData =
      await transferRestrictionsProgram.account.transferRule.fetch(
        transferRulePubkey,
        confirmOptions
      );
    assert.equal(
      transferRuleData.lockedUntil.toString(),
      lockedUntil.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdFrom.toString(),
      transferGroup.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdTo.toString(),
      transferGroup.toString()
    );
    assert.deepEqual(
      transferRuleData.transferRestrictionData,
      transferRestrictionDataPubkey
    );

    // 7.0. Create security associated account from and to
    const userWalletRecipient = Keypair.generate();
    const userWalletRecipientPubkey = userWalletRecipient.publicKey;
    const userWalletRecipientAssociatedTokenAccountPubkey =
      getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        userWalletRecipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
    await topUpWallet(provider.connection, userWallet.publicKey, 1000000000000);
    console.log(
      `User Wallet sender balance: ${await provider.connection.getBalance(
        userWalletPubkey
      )}`
    );

    // 7.1. Create Holder for sender
    console.log("7.1. Create Holder for sender");
    const senderHolderId = new anchor.BN(1);
    const [holderSenderPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
        transferRestrictionDataPubkey.toBuffer(),
        senderHolderId.toArrayLike(Buffer, "le", 8),
      ],
      transferRestrictionsProgram.programId
    );
    console.log("Sender Holder Pubkey", holderSenderPubkey.toBase58());
    const initSenderHolderTx = await transferRestrictionsProgram.methods
      .initializeTransferRestrictionHolder(senderHolderId)
      .accountsStrict({
        transferRestrictionHolder: holderSenderPubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        accessControlAccount: accessControlPubkey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Sender Holder Transaction Signature",
      initSenderHolderTx
    );
    const holderSenderData =
      await transferRestrictionsProgram.account.transferRestrictionHolder.fetch(
        holderSenderPubkey,
        confirmOptions
      );
    assert.equal(holderSenderData.id.toString(), senderHolderId.toString());
    assert.deepEqual(
      holderSenderData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderSenderData.currentWalletsCount.toString(),
      Number(0).toString()
    );

    // 7.2. Create Holder for recipient
    console.log("7.2. Create Holder for recipient");
    const recipientHolderId = new anchor.BN(2);
    const [holderRecipientPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
          transferRestrictionDataPubkey.toBuffer(),
          recipientHolderId.toArrayLike(Buffer, "le", 8),
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Recipient Holder Pubkey", holderRecipientPubkey.toBase58());
    const initRecipientHolderTx = await transferRestrictionsProgram.methods
      .initializeTransferRestrictionHolder(recipientHolderId)
      .accountsStrict({
        transferRestrictionHolder: holderRecipientPubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        accessControlAccount: accessControlPubkey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Recipient Holder Transaction Signature",
      initRecipientHolderTx
    );
    const holderRecipientData =
      await transferRestrictionsProgram.account.transferRestrictionHolder.fetch(
        holderRecipientPubkey,
        confirmOptions
      );
    assert.equal(
      holderRecipientData.id.toString(),
      recipientHolderId.toString()
    );
    assert.deepEqual(
      holderRecipientData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderRecipientData.currentWalletsCount.toString(),
      Number(0).toString()
    );

    // 7.3. Create Security Associated Account for sender
    console.log("7.3. Create Security Associated Account for sender");
    const [userWalletSenderSecurityAssociatedTokenAccountPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
          userWalletAssociatedAccountPubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Sender Security Associated Account Pubkey",
      userWalletSenderSecurityAssociatedTokenAccountPubkey.toBase58()
    );
    const initSecAssocAccountSenderTx =
      await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount:
            userWalletSenderSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroupPubkey,
          holder: holderSenderPubkey,
          securityToken: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          userWallet: userWalletPubkey,
          associatedTokenAccount: userWalletAssociatedAccountPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountSenderTx
    );
    const senderSecurityAssociatedAccountData =
      await transferRestrictionsProgram.account.securityAssociatedAccount.fetch(
        userWalletSenderSecurityAssociatedTokenAccountPubkey,
        confirmOptions
      );
    assert.equal(
      senderSecurityAssociatedAccountData.group.toString(),
      transferGroup.toString()
    );

    // 7.4. Create Security Associated Account for recipient
    console.log("7.4. Create Security Associated Account for recipient");
    const transactionCreateAssocAccRecipient = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        superAdmin.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWalletRecipientPubkey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const txCreateRecipientAssTokenAccount = await sendAndConfirmTransaction(
      provider.connection,
      transactionCreateAssocAccRecipient,
      [superAdmin],
      { commitment: confirmOptions }
    );
    console.log(
      "Create Recipient Associated Token Account Transaction Signature",
      txCreateRecipientAssTokenAccount
    );

    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
          userWalletRecipientAssociatedTokenAccountPubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Recipient Security Associated Account Pubkey",
      userWalletRecipientSecurityAssociatedTokenAccountPubkey.toBase58()
    );

    const initSecAssocAccountRecipientTx =
      await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount:
            userWalletRecipientSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroupPubkey,
          holder: holderRecipientPubkey,
          securityToken: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          userWallet: userWalletRecipientPubkey,
          associatedTokenAccount:
            userWalletRecipientAssociatedTokenAccountPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountRecipientTx
    );
    const recipientSecurityAssociatedAccountData =
      await transferRestrictionsProgram.account.securityAssociatedAccount.fetch(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey,
        confirmOptions
      );
    assert.equal(
      recipientSecurityAssociatedAccountData.group.toString(),
      transferGroup.toString()
    );

    // 7. Create Transfer
    console.log("7. Create Transfer with Hook");
    const transferAmount = BigInt(1000);
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userWalletAssociatedAccountPubkey,
        mintKeypair.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWallet.publicKey,
        transferAmount,
        decimals,
        undefined,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );

    const transferWithHookTx = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(transferWithHookInstruction),
      [userWallet],
      { commitment: confirmOptions }
    );
    console.log(
      "Transfer Securities Transaction Signature",
      transferWithHookTx
    );

    // 7.LAST. Check if the transfer was successful
    console.log("7.LAST. Check if the transfer was successful");
    const senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.deepEqual(senderAccountInfo.amount, BigInt(299000));
    assert.equal(
      recipientAccountInfo.amount.toString(),
      transferAmount.toString()
    );
  });
});
