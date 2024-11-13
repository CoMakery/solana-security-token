use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
    SecurityAssociatedAccount, TransferRestrictionData, TransferRule, TRANSFER_RULE_PREFIX,
};

use super::{SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX};

#[derive(Accounts)]
pub struct EnforceTransferRestrictions<'info> {
    #[account(
      token::mint = mint,
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub source_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
      token::mint = mint,
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub destination_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      seeds = [
          TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
          &mint.key().to_bytes(),
      ],
      bump,
    )]
    pub transfer_restriction_data: Box<Account<'info, TransferRestrictionData>>,

    #[account(
      seeds = [
          SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
          &source_account.key().to_bytes(),
      ],
      bump,
    )]
    pub security_associated_account_from: Box<Account<'info, SecurityAssociatedAccount>>,

    #[account(
      seeds = [
          SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
          &destination_account.key().to_bytes(),
      ],
      bump,
    )]
    pub security_associated_account_to: Box<Account<'info, SecurityAssociatedAccount>>,

    #[account(
      seeds = [
          TRANSFER_RULE_PREFIX.as_bytes(),
          &transfer_restriction_data.key().to_bytes(),
          &security_associated_account_from.group.to_le_bytes(),
          &security_associated_account_to.group.to_le_bytes(),
      ],
      bump,
    )]
    pub transfer_rule: Box<Account<'info, TransferRule>>,
}
