use crate::{
    contexts::InitializeAccessControl, errors::SolanaSecurityTokenError, update_account_lamports_to_minimum_balance, InitializeAccessControlArgs
};
use anchor_lang::prelude::*;

pub fn initialize(
    ctx: Context<InitializeAccessControl>,
    args: InitializeAccessControlArgs,
) -> Result<()> {
    if args.authority != ctx.accounts.authority.key() {
        return Err(SolanaSecurityTokenError::InvalidAuthority.into());
    }
    let access_control = &mut ctx.accounts.access_control;
    access_control.mint = *ctx.accounts.mint.to_account_info().key;
    access_control.authority = *ctx.accounts.authority.to_account_info().key;

    ctx.accounts
        .initialize_token_metadata(
            ctx.program_id,
            args.name,
            args.symbol,
            args.uri,
        )?;

    update_account_lamports_to_minimum_balance(
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    Ok(())
}
