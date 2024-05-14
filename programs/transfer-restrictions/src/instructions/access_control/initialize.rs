use crate::{
    contexts::InitializeAccessControl, get_extra_account_metas,
    update_account_lamports_to_minimum_balance, InitializeAccessControlArgs, Roles,
};
use anchor_lang::prelude::*;
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

pub fn initialize(
    ctx: Context<InitializeAccessControl>,
    _args: InitializeAccessControlArgs,
) -> Result<()> {
    let access_control = &mut ctx.accounts.access_control;
    access_control.mint = *ctx.accounts.mint.to_account_info().key;

    // initialize the extra metas account
    let extra_metas_account = &ctx.accounts.extra_metas_account;
    let metas = get_extra_account_metas()?;
    let mut data = extra_metas_account.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &metas)?;

    // // TODO: initialize token metadata separately
    // ctx.accounts
    //     .initialize_token_metadata(
    //         args.name,
    //         args.symbol,
    //         args.uri,
    //     )?;

    update_account_lamports_to_minimum_balance(
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    let wallet_role = &mut ctx.accounts.authority_wallet_role;
    wallet_role.role = Roles::All as u8;

    Ok(())
}
