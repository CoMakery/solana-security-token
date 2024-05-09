pub mod instructions;

pub use instructions::*;

use anchor_lang::prelude::*;

declare_id!("38jsTJqL7seGftcurfNJG1DsXa4WwCrHuNq4q1m9uZ9j");

#[program]
pub mod security_transfer_hook {
    use super::*;

    /// execute transfer hook
    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute_transaction(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
        instructions::handler(ctx, amount)
    }
}
