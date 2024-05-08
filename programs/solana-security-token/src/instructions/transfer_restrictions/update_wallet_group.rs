use anchor_lang::prelude::*;
use crate::contexts::UpdateWalletGroup;

pub fn update_wallet_group(ctx: Context<UpdateWalletGroup>) -> Result<()> {
  // TODO: add check that signer has rights to update wallet group
  // check group max count
  // add previous group account in order to decrease walletsCount
  let security_associated_account = &mut ctx.accounts.security_associated_account;
  security_associated_account.group = ctx.accounts.transfer_restriction_group.key();

  Ok(())
}