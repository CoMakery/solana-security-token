use crate::{
    contexts::InitializeExtraAccountMetaList, errors::SolanaSecurityTokenError, get_extra_account_metas, Roles
};
use anchor_lang::prelude::*;
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::ContractAdmin) {
        return Err(SolanaSecurityTokenError::Unauthorized.into());
    }

    let extra_metas_account = &ctx.accounts.extra_metas_account;
    let metas = get_extra_account_metas()?;
    let mut data = extra_metas_account.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &metas)?;

    Ok(())
}
