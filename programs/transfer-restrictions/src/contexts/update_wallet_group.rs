use access_control::WalletRole;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    SecurityAssociatedAccount, TransferRestrictionData, TransferRestrictionGroup,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_GROUP_PREFIX,
};

#[derive(Accounts)]
pub struct UpdateWalletGroup<'info> {
    #[account(mut,
        seeds = [
        SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
        &associated_token_account.key().to_bytes(),
        ],
        bump,
    )]
    pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
    #[account(
        constraint = security_token.key() == transfer_restriction_data.security_token_mint,
    )]
    pub security_token: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &security_token.key().to_bytes(),
        ],
        bump
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
    #[account(
        constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
        seeds = [
            TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
            &transfer_restriction_data.key().to_bytes(),
            &group.id.to_le_bytes(),
        ],
        bump,
    )]
    pub group: Account<'info, TransferRestrictionGroup>,
    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == transfer_restriction_data.access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    /// CHECK: Wallet address which role to be updated
    pub user_wallet: AccountInfo<'info>,
    #[account(
        associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
        associated_token::mint = security_token,
        associated_token::authority = user_wallet,
    )]
    pub associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
