use anchor_lang::prelude::*;
use anchor_spl::{token_2022::ID as TOKEN_2022_PROGRAM_ID, token_interface::Mint};

use crate::{AccessControl, WalletRole, ACCESS_CONTROL_SEED};

#[derive(Accounts)]
pub struct SetMaxTotalSupply<'info> {
    #[account(mut,
        seeds = [
        ACCESS_CONTROL_SEED,
        mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control_account: Account<'info, AccessControl>,

    #[account(
        mint::token_program = TOKEN_2022_PROGRAM_ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(mut)]
    pub payer: Signer<'info>,
}
