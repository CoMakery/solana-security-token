use anchor_lang::prelude::*;
use anchor_spl::token_interface::{freeze_account, FreezeAccount};

use crate::{errors::AccessControlError, FreezeWallet, ACCESS_CONTROL_SEED};

pub fn freeze_wallet(ctx: Context<FreezeWallet>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(crate::Roles::TransferAdmin as u8 | crate ::Roles::WalletsAdmin as u8)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    let mint = ctx.accounts.security_mint.to_account_info();
    let accounts = FreezeAccount {
        mint: mint.clone(),
        account: ctx.accounts.target_account.to_account_info(),
        authority: ctx.accounts.access_control.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), accounts);

    let (_pda, bump_seed) =
        Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.key.as_ref()], ctx.program_id);

    let seeds = &[ACCESS_CONTROL_SEED, mint.key.as_ref(), &[bump_seed]];

    freeze_account(cpi_ctx.with_signer(&[&seeds[..]]))?;

    Ok(())
}
