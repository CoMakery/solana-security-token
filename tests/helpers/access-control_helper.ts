import { Program, utils, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Commitment,
  Connection,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { AccessControl } from "../../target/types/access_control";
import {
  TOKEN_2022_PROGRAM_ID,
  addExtraAccountMetasForExecute,
  getMint,
  getTransferHook,
} from "@solana/spl-token";

export const ACCESS_CONTROL_PREFIX = "ac";
export const WALLET_ROLE_PREFIX = "wallet_role";

export enum Roles {
  None = 0,
  ContractAdmin = 1,
  ReserveAdmin = 2,
  WalletsAdmin = 4,
  TransferAdmin = 8,
  All = 15,
}

// confirmOptions
export class SetupAccessControlArgs {
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
  payer: PublicKey;
  authority: PublicKey;
  hookProgramId: PublicKey;
  maxTotalSupply: BN;
}

export class AccessControlHelper {
  program: Program<AccessControl>;
  mintPubkey: PublicKey;
  accessControlPubkey: PublicKey;
  confirmOptions: Commitment = "confirmed";

  constructor(
    accessControlProgram: Program<AccessControl>,
    mintPubkey: PublicKey,
    confirmOptions: Commitment = "confirmed"
  ) {
    this.program = accessControlProgram;
    this.mintPubkey = mintPubkey;
    this.accessControlPubkey = this.accessControlPDA()[0];
    this.confirmOptions = confirmOptions;
  }

  walletRolePDA(walletPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(WALLET_ROLE_PREFIX),
        this.mintPubkey.toBuffer(),
        walletPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  accessControlPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(ACCESS_CONTROL_PREFIX),
        this.mintPubkey.toBuffer(),
      ],
      this.program.programId
    );
  }

  initializeAccessControlInstruction(
    setupAccessControlArgs: SetupAccessControlArgs
  ): any {
    const walletRolePubkey = this.walletRolePDA(
      setupAccessControlArgs.payer
    )[0];

    return this.program.instruction.initializeAccessControl(
      {
        decimals: setupAccessControlArgs.decimals,
        name: setupAccessControlArgs.name,
        symbol: setupAccessControlArgs.symbol,
        uri: setupAccessControlArgs.uri,
        hookProgramId: setupAccessControlArgs.hookProgramId,
        maxTotalSupply: setupAccessControlArgs.maxTotalSupply,
      },
      {
        accounts: {
          payer: setupAccessControlArgs.payer,
          authority: setupAccessControlArgs.authority,
          mint: this.mintPubkey,
          accessControl: this.accessControlPubkey,
          walletRole: walletRolePubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
      }
    );
  }

  async accessControlData(): Promise<any> {
    return this.program.account.accessControl.fetch(
      this.accessControlPubkey,
      this.confirmOptions
    );
  }

  async walletRoleData(walletRolePubkey: PublicKey): Promise<any> {
    return this.program.account.walletRole.fetch(
      walletRolePubkey,
      this.confirmOptions
    );
  }

  async mintSecurities(
    amount: BN,
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    signer: Keypair
  ): Promise<string> {
    const authorityWalletRolePubkey = this.walletRolePDA(signer.publicKey)[0];

    return this.program.methods
      .mintSecurities(amount)
      .accountsStrict({
        authority: signer.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        securityMint: this.mintPubkey,
        destinationAccount: userWalletAssociatedAccountPubkey,
        destinationAuthority: userWalletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: this.confirmOptions });
  }

  async burnSecurities(
    amount: BN,
    userWalletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    signer: Keypair
  ): Promise<string> {
    const authorityWalletRolePubkey = this.walletRolePDA(signer.publicKey)[0];

    return this.program.methods
      .burnSecurities(amount)
      .accountsStrict({
        authority: signer.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        securityMint: this.mintPubkey,
        targetAccount: userWalletAssociatedAccountPubkey,
        targetAuthority: userWalletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: this.confirmOptions });
  }

  async initializeWalletRole(
    walletPubkey: PublicKey,
    role: Roles,
    signer: Keypair
  ): Promise<string> {
    const authorityWalletRolePubkey = this.walletRolePDA(signer.publicKey)[0];
    const walletRolePubkey = this.walletRolePDA(walletPubkey)[0];

    return this.program.methods
      .initializeWalletRole(role)
      .accountsStrict({
        walletRole: walletRolePubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        securityToken: this.mintPubkey,
        userWallet: walletPubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: this.confirmOptions });
  }

  async updateWalletRole(
    walletPubkey: PublicKey,
    newRoles: Roles,
    signer: Keypair
  ): Promise<string> {
    const authorityWalletRolePubkey = this.walletRolePDA(signer.publicKey)[0];
    const walletRolePubkey = this.walletRolePDA(walletPubkey)[0];
    return this.program.methods
      .updateWalletRole(newRoles)
      .accountsStrict({
        walletRole: walletRolePubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        securityToken: this.mintPubkey,
        userWallet: walletPubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: this.confirmOptions });
  }

  async freezeWallet(
    walletPubkey: PublicKey,
    userWalletAssociatedAccountPubkey: PublicKey,
    signer: Keypair
  ): Promise<string> {
    const authorityWalletRolePubkey = this.walletRolePDA(signer.publicKey)[0];

    return this.program.methods
      .freezeWallet()
      .accountsStrict({
        authority: signer.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: this.accessControlPubkey,
        securityMint: this.mintPubkey,
        targetAccount: userWalletAssociatedAccountPubkey,
        targetAuthority: walletPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: this.confirmOptions });
  }

  async forceTransferBetween(
    amount: number | bigint,
    fromOwnerPubkey: PublicKey,
    fromAccountPubkey: PublicKey,
    toOwnerPubkey: PublicKey,
    toAccountPubkey: PublicKey,
    signer: Keypair,
    connection: Connection
  ) {
    const reserveAdminRolePubkey = this.walletRolePDA(signer.publicKey)[0];

    const forceTransferBetweenInstruction =
      this.program.instruction.forceTransferBetween(new BN(amount.toString()), {
        accounts: {
          authority: signer.publicKey,
          authorityWalletRole: reserveAdminRolePubkey,
          accessControlAccount: this.accessControlPubkey,
          securityMint: this.mintPubkey,
          sourceAccount: fromAccountPubkey,
          sourceAuthority: fromOwnerPubkey,
          destinationAccount: toAccountPubkey,
          destinationAuthority: toOwnerPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
      });

    const mintInfo = await getMint(
      connection,
      this.mintPubkey,
      this.confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    const transferHook = getTransferHook(mintInfo);

    await addExtraAccountMetasForExecute(
      connection,
      forceTransferBetweenInstruction,
      transferHook.programId,
      fromAccountPubkey,
      this.mintPubkey,
      toAccountPubkey,
      fromOwnerPubkey,
      amount,
      this.confirmOptions
    );

    const modifyComputeUnitsInstruction =
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000,
      });

    const transferWithHookTxSignature = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        ...[modifyComputeUnitsInstruction, forceTransferBetweenInstruction]
      ),
      [signer],
      { commitment: this.confirmOptions }
    );

    return transferWithHookTxSignature;
  }
}
