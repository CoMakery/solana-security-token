use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::events::FundedEvent;
use crate::utils::validate_transfer_fee_mint_extension;
use crate::{errors::DividendsErrorCode, MerkleDistributor};

/// [merkle_distributor::fund_dividends] accounts.
#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct FundDividends<'info> {
    /// The [MerkleDistributor].
    #[account(mut,
        address = to.owner,
        constraint = distributor.paused == false @ DividendsErrorCode::DistributionPaused,
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Account which send the funding tokens.
    #[account(mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub from: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Distributor ATA containing the tokens to distribute.
    #[account(mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub to: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Who is funding the tokens.
    #[account(address = from.owner @ DividendsErrorCode::OwnerMismatch)]
    pub funder: Signer<'info>,

    /// Payer of the fund dividends.
    #[account(mut)]
    pub payer: Signer<'info>,

    // Distributor's token mint.
    #[account(address = distributor.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// SPL [Token] program.
    pub token_program: Interface<'info, TokenInterface>,
}

// only transfer admin can fund the distributor
/// Fund dividend tokens to the [MerkleDistributor].
pub fn fund_dividends<'info>(
    ctx: Context<'_, '_, '_, 'info, FundDividends<'info>>,
    amount: u64,
) -> Result<()> {
    require!(
        ctx.accounts.from.key() != ctx.accounts.to.key(),
        DividendsErrorCode::KeysMustNotMatch
    );
    require!(
        // Ensure the funded amount exactly matches the total claim amount
        ctx.accounts.to.amount.checked_add(amount).unwrap()
            == ctx.accounts.distributor.total_claim_amount,
        DividendsErrorCode::InvalidFundingAmount
    );
    let mint_data = &ctx.accounts.mint.to_account_info();
    validate_transfer_fee_mint_extension(mint_data)?;

    let distributor = &mut ctx.accounts.distributor;
    let treasury_amount_before = ctx.accounts.to.amount;

    let token_program_id = ctx.accounts.token_program.key;
    let source_info = ctx.accounts.from.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let destination_info = ctx.accounts.to.to_account_info();
    let authority_info = ctx.accounts.funder.to_account_info();
    let decimals = ctx.accounts.mint.decimals;
    invoke_transfer_checked(
        token_program_id,
        source_info.clone(),
        mint_info.clone(),
        destination_info.clone(),
        authority_info.clone(),
        ctx.remaining_accounts,
        amount,
        decimals,
        &[],
    )?;
    if treasury_amount_before.checked_add(amount).unwrap() >= distributor.total_claim_amount {
        distributor.ready_to_claim = true;
    }

    emit!(FundedEvent {
        distributor: distributor.key(),
        funder: ctx.accounts.from.key(),
        amount
    });
    Ok(())
}
