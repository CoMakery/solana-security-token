use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    contexts::common::DISCRIMINATOR_LEN, AccessControl, WalletRole, ACCESS_CONTROL_SEED,
    WALLET_ROLE_PREFIX,
};

#[derive(Accounts)]
#[instruction()]
pub struct InitializeDeployerRole<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
      seeds = [
        WALLET_ROLE_PREFIX,
        &security_token.key().to_bytes(),
        &payer.key().to_bytes(),
      ],
      bump,
    )]
    pub wallet_role: Account<'info, WalletRole>,
    #[account(
      constraint = security_token.key() == access_control.mint,
      seeds = [
        ACCESS_CONTROL_SEED,
        security_token.key().as_ref(),
      ],
      bump,
    )]
    pub access_control: Account<'info, AccessControl>,
    pub security_token: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
      constraint = payer.key() == access_control.authority,
    )]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
