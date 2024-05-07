use crate::contexts::common::DISCRIMINATOR_LEN;

#[account]
#[derive(Default)]
pub struct Role {
  pub role: u8
}

impl Role {
  const ROLE_LEN: usize = mem::size_of::<u8>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::ROLE_LEN
  }
}

#[derive(Accounts)]
pub struct SetRole<'info> {
  #[account(init_if_needed, payer = payer, space = Role::size())]
  pub role: Account<'info, Role>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
