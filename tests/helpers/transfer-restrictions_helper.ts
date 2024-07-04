import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Commitment } from "@solana/web3.js";
import { TransferRestrictions } from "../../target/types/transfer_restrictions";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export const EXTRA_METAS_ACCOUNT_PREFIX = "extra-account-metas";
export const TRANSFER_RESTRICTION_GROUP_PREFIX = "trg";
export const TRANSFER_RESTRICTION_DATA_PREFIX = "trd";
export const TRANSFER_RULE_PREFIX = "tr";
export const SECURITY_ASSOCIATED_ACCOUNT_PREFIX = "saa"; // security associated account
export const TRANSFER_RESTRICTION_HOLDER_PREFIX = "trh"; // transfer_restriction_holder
export const TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX = "trhg"; // transfer_restriction_holder_group

export class TransferRestrictionsHelper {
  program: Program<TransferRestrictions>;
  mintPubkey: PublicKey;
  transferRestrictionDataPubkey: PublicKey;
  accessControlPubkey: PublicKey;
  confirmOptions: Commitment = "confirmed";

  constructor(
    transferRestrictionsProgram: Program<TransferRestrictions>,
    mintPubkey: PublicKey,
    accessControlPubkey: PublicKey,
    confirmOptions: Commitment = "confirmed"
  ) {
    this.program = transferRestrictionsProgram;
    this.mintPubkey = mintPubkey;
    this.transferRestrictionDataPubkey = this.transferRestrictionDataPDA()[0];
    this.accessControlPubkey = accessControlPubkey;
    this.confirmOptions = confirmOptions;
  }

  transferRestrictionDataPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_DATA_PREFIX),
        this.mintPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  async transferRestrictionData(): Promise<any> {
    return this.program.account.transferRestrictionData.fetch(
      this.transferRestrictionDataPubkey,
      this.confirmOptions
    );
  }

  groupPDA(groupId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_GROUP_PREFIX),
        this.transferRestrictionDataPubkey.toBuffer(),
        groupId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async groupData(groupPubkey: PublicKey): Promise<any> {
    return this.program.account.transferRestrictionGroup.fetch(
      groupPubkey,
      this.confirmOptions
    );
  }

  holderPDA(holderId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
        this.transferRestrictionDataPubkey.toBuffer(),
        holderId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async holderData(holderPubkey: PublicKey): Promise<any> {
    return this.program.account.transferRestrictionHolder.fetch(
      holderPubkey,
      this.confirmOptions
    );
  }

  holderGroupPDA(holderPubkey: PublicKey, groupId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_GROUP_PREFIX),
        holderPubkey.toBuffer(),
        groupId.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  async holderGroupData(holderGroupPubkey: PublicKey): Promise<any> {
    return this.program.account.holderGroup.fetch(
      holderGroupPubkey,
      this.confirmOptions
    );
  }

  transferRulePDA(
    groupFromPubkey: PublicKey,
    groupToPubkey: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RULE_PREFIX),
        groupFromPubkey.toBuffer(),
        groupToPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  async transferRuleData(transferRulePubkey: PublicKey): Promise<any> {
    return this.program.account.transferRule.fetch(
      transferRulePubkey,
      this.confirmOptions
    );
  }

  securityAssociatedAccountPDA(
    userWalletAssociatedAccountPubkey: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
        userWalletAssociatedAccountPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  async securityAssociatedAccountData(
    securityAssociatedAccountPubkey: PublicKey
  ): Promise<any> {
    return this.program.account.securityAssociatedAccount.fetch(
      securityAssociatedAccountPubkey,
      this.confirmOptions
    );
  }

  extraMetasAccountPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(EXTRA_METAS_ACCOUNT_PREFIX), this.mintPubkey.toBuffer()],
      this.program.programId
    );
  }

  initializeExtraMetasAccount(
    payer: PublicKey,
    authorityWalletRolePubkey: PublicKey
  ): any {
    return this.program.instruction.initializeExtraAccountMetaList({
      accounts: {
        extraMetasAccount: this.extraMetasAccountPDA()[0],
        securityMint: this.mintPubkey,
        payer,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        systemProgram: SystemProgram.programId,
      },
    });
  }

  initializeTransferRestrictionData(
    maxHolders: BN,
    minWalletBalance: BN,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): any {
    return this.program.methods
      .initializeTransferRestrictionsData(maxHolders, minWalletBalance)
      .accountsStrict({
        transferRestrictionData: this.transferRestrictionDataPubkey,
        accessControlAccount: this.accessControlPubkey,
        mint: this.mintPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeTransferRestrictionGroup(
    groupId: BN,
    payer: Keypair
  ): Promise<string> {
    const [transferRestrictionGroup1Pubkey] = this.groupPDA(groupId);

    return this.program.methods
      .initializeTransferRestrictionGroup(groupId)
      .accountsStrict({
        transferRestrictionGroup: transferRestrictionGroup1Pubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        payer: payer.publicKey,
        accessControlAccount: this.accessControlPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeTransferRule(
    lockedUntil: BN,
    transferRuleFromPubkey: PublicKey,
    transferRuleToPubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    const [transferRulePubkey] = this.transferRulePDA(
      transferRuleFromPubkey,
      transferRuleToPubkey
    );

    return this.program.methods
      .initializeTransferRule(lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: transferRuleFromPubkey,
        transferRestrictionGroupTo: transferRuleToPubkey,
        accessControlAccount: this.accessControlPubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeTransferRestrictionHolder(
    holderId: BN,
    payer: Keypair
  ): Promise<string> {
    const [holderPubkey] = this.holderPDA(holderId);

    return this.program.methods
      .initializeTransferRestrictionHolder(holderId)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        payer: payer.publicKey,
        accessControlAccount: this.accessControlPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeSecurityAssociatedAccount(
    groupPubkey: PublicKey,
    holderPubkey: PublicKey,
    holderGroupPubkey: PublicKey,
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    const [securityAssociatedAccountPubkey] = this.securityAssociatedAccountPDA(
      userWalletAssociatedAccountPubkey
    );

    return this.program.methods
      .initializeSecurityAssociatedAccount()
      .accountsStrict({
        securityAssociatedAccount: securityAssociatedAccountPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        holderGroup: holderGroupPubkey,
        securityToken: this.mintPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        userWallet: userWalletPubkey,
        associatedTokenAccount: userWalletAssociatedAccountPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeHolderGroup(
    holderGroupPubkey: PublicKey,
    holderPubkey: PublicKey,
    groupPubkey: PublicKey,
    authorityWalletRolePubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }

  async updateWalletGroup(
    userWalletSecAssociatedAccountPubkey: PublicKey,
    groupCurrentPubkey: PublicKey,
    groupNewPubkey: PublicKey,
    holderGroupCurrentPubkey: PublicKey,
    holderGroupNewPubkey: PublicKey,
    authorityWalletRole: PublicKey,
    userWalletPubkey: PublicKey,
    userTokenAccountPubkey: PublicKey,
    payer: Keypair
  ): Promise<string> {
    return this.program.methods
      .updateWalletGroup()
      .accountsStrict({
        securityAssociatedAccount: userWalletSecAssociatedAccountPubkey,
        securityToken: this.mintPubkey,
        transferRestrictionData: this.transferRestrictionDataPubkey,
        transferRestrictionGroupCurrent: groupCurrentPubkey,
        transferRestrictionGroupNew: groupNewPubkey,
        holderGroupCurrent: holderGroupCurrentPubkey,
        holderGroupNew: holderGroupNewPubkey,
        authorityWalletRole,
        userWallet: userWalletPubkey,
        userAssociatedTokenAccount: userTokenAccountPubkey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc({ commitment: this.confirmOptions });
  }
}
