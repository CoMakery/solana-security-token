use anchor_lang::prelude::*;

use crate::ExecuteTransferHook;


pub fn handler(
  _ctx: Context<ExecuteTransferHook>,
  _amount: u64,
) -> Result<()> {
  // TODO: add transfer restrictions checks here
  Ok(())
}
