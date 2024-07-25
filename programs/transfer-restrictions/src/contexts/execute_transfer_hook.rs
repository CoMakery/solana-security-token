use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};


#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct ExecuteTransferHook<'info> {
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

    /// CHECK: can be any account
    pub owner_delegate: UncheckedAccount<'info>,

    /// CHECK: meta list account
    #[account(
      seeds = [b"extra-account-metas", mint.key().as_ref()],
      bump,
    )]
    pub extra_metas_account: UncheckedAccount<'info>,

    /// CHECK: Box<Account<'info, TransferRestrictionData>>
    pub transfer_restriction_data: UncheckedAccount<'info>,

    /// CHECK: Box<Account<'info, SecurityAssociatedAccount>>
    pub security_associated_account_from: UncheckedAccount<'info>,

    /// CHECK: Box<Account<'info, SecurityAssociatedAccount>>
    pub security_associated_account_to: UncheckedAccount<'info>,

    // #[account(
    //   seeds = [
    //     TRANSFER_RULE_PREFIX.as_bytes(),
    //     &transfer_restriction_data.key().to_bytes(),
    //     &security_associated_account_from.group.to_le_bytes(),
    //     &security_associated_account_to.group.to_le_bytes(),
    //   ],
    //   bump,
    // )]
    /// CHECK: Box<Account<'info, TransferRule>>
    pub transfer_rule: UncheckedAccount<'info>,
}
