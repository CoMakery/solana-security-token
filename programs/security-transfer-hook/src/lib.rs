use anchor_lang::prelude::*;

declare_id!("4yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ");

#[program]
pub mod solana_security_token {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}