use crate::get_meta_list_size;
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::{token_2022::ID as TOKEN_2022_PROGRAM_ID, token_interface::Mint};

pub const META_LIST_ACCOUNT_SEED: &[u8] = b"extra-account-metas";

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(
      init,
      space = get_meta_list_size()?,
      seeds = [
        META_LIST_ACCOUNT_SEED,
        security_mint.key().as_ref(),
      ],
      bump,
      payer = payer,
    )]
    /// CHECK: extra metas account
    pub extra_metas_account: UncheckedAccount<'info>,

    #[account(
        mint::token_program = TOKEN_2022_PROGRAM_ID,
    )]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      constraint = authority_wallet_role.owner == payer.key(),
      constraint = authority_wallet_role.access_control == access_control.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
      constraint = security_mint.key() == access_control.mint,
    )]
    pub access_control: Box<Account<'info, AccessControl>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
