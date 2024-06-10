use anchor_lang::prelude::*;
use anchor_spl::token_interface::{mint_to, MintTo};

use crate::{errors::AccessControlError, MintSecurities, ACCESS_CONTROL_SEED};

pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(crate::Roles::ReserveAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    let mint = ctx.accounts.security_mint.to_account_info();
    let accounts = MintTo {
        mint: mint.clone(),
        to: ctx.accounts.destination_account.to_account_info(),
        authority: ctx.accounts.access_control.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    let (_pda, bump_seed) =
        Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.key.as_ref()], ctx.program_id);

    let seeds = &[ACCESS_CONTROL_SEED, mint.key.as_ref(), &[bump_seed]];

    mint_to(cpi_ctx.with_signer(&[&seeds[..]]), amount)?;

    Ok(())
}
