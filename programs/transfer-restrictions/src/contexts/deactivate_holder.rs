use crate::{
    TransferRestrictionData, TransferRestrictionHolder, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_HOLDER_PREFIX,
};
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DeactivateHolder<'info> {
    #[account(mut,
        seeds = [
        TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(),
        &transfer_restriction_data.key().to_bytes(),
        &holder.id.to_le_bytes(),
        ],
        bump,
    )]
    pub holder: Account<'info, TransferRestrictionHolder>,

    #[account(mut,
        seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &access_control_account.mint.key().to_bytes(),
        ],
        bump,
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,

    pub access_control_account: Account<'info, AccessControl>,

    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
