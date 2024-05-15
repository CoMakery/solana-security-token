use anchor_lang::{prelude::*, solana_program::program_option::COption};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

use crate::{AccessControl, WalletRole, ACCESS_CONTROL_SEED, WALLET_ROLE_PREFIX};


#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct BurnSecurities<'info> {
    #[account()]
    pub authority: Signer<'info>,
    #[account(
      seeds = [
        WALLET_ROLE_PREFIX,
        &security_mint.key().to_bytes(),
        &authority.key().to_bytes(),
      ],
      bump,
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(
      constraint = security_mint.key() == access_control.mint,
      seeds = [
        ACCESS_CONTROL_SEED,
        security_mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control: Box<Account<'info, AccessControl>>,
    #[account(
        mut,
        constraint = security_mint.mint_authority == COption::Some(access_control.key()),
    )]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::token_program = token_program,
        associated_token::mint = security_mint,
        associated_token::authority = target_authority,
    )]
    pub target_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: The destination_authority account is the account that owner of the destination_account
    pub target_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
}
