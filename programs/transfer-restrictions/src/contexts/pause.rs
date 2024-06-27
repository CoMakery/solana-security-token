use access_control::{AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

#[derive(Accounts)]
#[instruction(paused: bool)]
pub struct Pause<'info> {
    #[account(
      constraint = security_mint.key() == transfer_restriction_data.security_token_mint,
    )]
    pub security_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut,
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &security_mint.key().to_bytes(),
      ],
      bump
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
    #[account(
      constraint = security_mint.key() == access_control_account.mint,
    )]
    pub access_control_account: Account<'info, AccessControl>,
    #[account(
      constraint = authority_wallet_role.owner == payer.key(),
      constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
