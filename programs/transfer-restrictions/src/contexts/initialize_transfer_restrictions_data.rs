use crate::contexts::common::DISCRIMINATOR_LEN;
use access_control::{self, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022};

pub const TRANSFER_RESTRICTION_DATA_PREFIX: &str = "trd"; // transfer_restriction_data

#[account]
#[derive(Default, InitSpace)]
pub struct TransferRestrictionData {
    pub security_token_mint: Pubkey,
    pub access_control_account: Pubkey,
    pub current_holders_count: u64,
    pub max_holders: u64,
    pub min_wallet_balance: u64,
}

impl TransferRestrictionData {
    /// Checks if a wallet can leave a group based on the new group ID and wallet balance.
    ///
    /// # Arguments
    ///
    /// * `new_group_id` - The ID of the new group. 0 group has special privileges.
    /// * `wallet_balance` - The balance of the wallet.
    ///
    /// # Returns
    ///
    /// Returns `true` if the wallet can leave the group, `false` otherwise.
    pub fn can_leave_group(&self, new_group_id: u64, wallet_balance: u64) -> bool {
        new_group_id == 0
            || self.min_wallet_balance == 0
            || wallet_balance <= self.min_wallet_balance
    }
}

#[derive(Accounts)]
#[instruction(max_holders: u64, min_wallet_balance: u64)]
pub struct InitializeTransferRestrictionData<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionData::INIT_SPACE,
      seeds = [
        TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
        &mint.key().to_bytes(),
      ],
      bump,
    )]
    pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
    #[account(
        mint::token_program = token_program,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        constraint = access_control_account.mint == mint.key(),
    )]
    pub access_control_account: Account<'info, AccessControl>,
    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.access_control == access_control_account.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}
