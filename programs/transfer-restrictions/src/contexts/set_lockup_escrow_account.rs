use std::str::FromStr;
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, ID as TOKEN_2022_PROGRAM_ID},
    token_interface::{Mint, TokenAccount},
};

use crate::{TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

const TOKENLOCK_ID: &str = "7CN3iHcRimZRa97M38cyMQAF68ecQYDqHfCUgBeSARG2";
#[derive(Accounts)]
pub struct SetLockupEscrowAccount<'info> {
    #[account(mut,
        seeds = [
            TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
            &mint.key().to_bytes(),
        ],
        bump,
        constraint = transfer_restriction_data.security_token_mint == mint.key(),
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,

    #[account(
        mint::token_program = TOKEN_2022_PROGRAM_ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        constraint = access_control_account.mint == mint.key(),
        constraint = access_control_account.key() == transfer_restriction_data.access_control_account,
    )]
    pub access_control_account: Account<'info, AccessControl>,
    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
        token::mint = mint,
        token::token_program = token_2022::ID,
        constraint = escrow_account.mint == mint.key(),
    )]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: implemented own serialization in order to save compute units
    #[account(
        constraint = *tokenlock_account.owner == Pubkey::from_str(TOKENLOCK_ID).unwrap(),
    )]
    pub tokenlock_account: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
