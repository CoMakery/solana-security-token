use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
  token_metadata_initialize, Mint, Token2022, TokenMetadataInitialize,
};
use num_enum::IntoPrimitive;

use crate::{
  contexts::common::DISCRIMINATOR_LEN, get_meta_list_size, WalletRole, WALLET_ROLE_PREFIX
};

pub const META_LIST_ACCOUNT_SEED: &[u8] = b"extra-account-metas";
pub const ACCESS_CONTROL_SEED: &[u8] = b"access_control";

#[repr(u8)]
#[derive(IntoPrimitive, AnchorDeserialize, AnchorSerialize, Clone, InitSpace, Copy, Debug)]
pub enum Roles {
  ContractAdmin = 1,
  ReserveAdmin = 2,
  WalletAdmin = 4,
  TransferAdmin = 8,
  All = 15,
}

#[account()]
#[derive(InitSpace)]
pub struct AccessControl {
  pub mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeAccessControlArgs {
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub delegate: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(args: InitializeAccessControlArgs)]
pub struct InitializeAccessControl<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,
  #[account()]
  /// CHECK: can be any account
  pub authority: UncheckedAccount<'info>,

  #[account(
    init,
    signer,
    payer = payer,
    mint::token_program = token_program,
    mint::decimals = args.decimals,
    mint::authority = access_control.key(),
    mint::freeze_authority = access_control.key(),
    extensions::transfer_hook::authority = access_control.key(),
    extensions::transfer_hook::program_id = crate::ID,
    extensions::group_member_pointer::authority = access_control.key(),
    extensions::group_member_pointer::member_address = mint,
    extensions::group_pointer::authority = access_control.key(),
    extensions::group_pointer::group_address = mint,
    extensions::metadata_pointer::authority = access_control.key(),
    extensions::metadata_pointer::metadata_address = mint,
    extensions::permanent_delegate::delegate =  access_control.key(),
  )]
  pub mint: Box<InterfaceAccount<'info, Mint>>,
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AccessControl::INIT_SPACE,
    seeds = [
      ACCESS_CONTROL_SEED,
      mint.key().as_ref(),
    ],
    bump,
  )]
  pub access_control: Box<Account<'info, AccessControl>>,
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
    seeds = [
      WALLET_ROLE_PREFIX,
      mint.to_account_info().key.as_ref(),
      authority.to_account_info().key.as_ref(),
    ],
    bump,
  )]
  pub authority_wallet_role: Box<Account<'info, WalletRole>>,
  #[account(
    init,
    space = get_meta_list_size()?,
    seeds = [
      META_LIST_ACCOUNT_SEED,
      mint.key().as_ref(),
    ],
    bump,
    payer = payer,
  )]
  /// CHECK: extra metas account
  pub extra_metas_account: UncheckedAccount<'info>,

  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token2022>,
}

impl<'info> InitializeAccessControl<'info> {
  pub fn initialize_token_metadata(&self, name: String, symbol: String, uri: String) -> Result<()> {
    let cpi_accounts = TokenMetadataInitialize {
      token_program_id: self.token_program.to_account_info(),
      mint: self.mint.to_account_info(),
      metadata: self.mint.to_account_info(), // metadata account is the mint, since data is stored in mint
      mint_authority: self.access_control.to_account_info(),
      update_authority: self.access_control.to_account_info(),
    };  
    let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
    token_metadata_initialize(cpi_ctx, name, symbol, uri)?;

    Ok(())
  }
}
