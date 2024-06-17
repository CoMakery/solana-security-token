import {
  Program,
  utils,
  BN
} from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import { AccessControl } from "../../target/types/access_control";
import {
  TOKEN_2022_PROGRAM_ID,
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

  walletRolePDA(
    walletPubkey: PublicKey,
  ): [PublicKey, number] {
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

  initializeAccessControlInstruction(setupAccessControlArgs: SetupAccessControlArgs): any {
    console.log("initializeAccessControlInstruction");
    console.log(`hookProgramId: ${setupAccessControlArgs.hookProgramId}`);
    
    
    return this.program.instruction.initializeAccessControl(
      {
        decimals: setupAccessControlArgs.decimals,
        name: setupAccessControlArgs.name,
        symbol: setupAccessControlArgs.symbol,
        uri: setupAccessControlArgs.uri,
        hookProgramId: setupAccessControlArgs.hookProgramId,
      },
      {
        accounts: {
          payer: setupAccessControlArgs.payer,
          authority: setupAccessControlArgs.authority,
          mint: this.mintPubkey,
          accessControl: this.accessControlPubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
      }
    );
  }

  initializeDeployerRoleInstruction(payer: PublicKey): any {
    const authorityWalletRolePubkey = this.walletRolePDA(payer)[0];

    return this.program.instruction
      .initializeDeployerRole({
        accounts: {
          payer,
          accessControl: this.accessControlPubkey,
          securityToken: this.mintPubkey,
          walletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        },
      });
  }

  async accessControlData(): Promise<any> {
    return this.program.account.accessControl.fetch(this.accessControlPubkey, this.confirmOptions);
  }

  async walletRoleData(walletRolePubkey: PublicKey): Promise<any> {
    return this.program.account.walletRole.fetch(walletRolePubkey, this.confirmOptions);
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

  async initializeWalletRole(walletPubkey: PublicKey, role: Roles, signer: Keypair): Promise<string> {
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


  async updateWalletRole(walletPubkey: PublicKey, newRoles: Roles, signer: Keypair): Promise<string> {
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
}
