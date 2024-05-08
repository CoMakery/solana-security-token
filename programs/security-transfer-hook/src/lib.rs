use anchor_lang::prelude::*;

declare_id!("38jsTJqL7seGftcurfNJG1DsXa4WwCrHuNq4q1m9uZ9j");

#[program]
pub mod solana_security_token {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}