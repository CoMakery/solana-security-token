use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::{token_2022::ID as TOKEN_2022_PROGRAM_ID, token_interface::Mint};

use crate::{TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

#[derive(Accounts)]
#[instruction(holder_max: u64)]
pub struct SetHolderMax<'info> {
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
    #[account(mut)]
    pub payer: Signer<'info>,
}
