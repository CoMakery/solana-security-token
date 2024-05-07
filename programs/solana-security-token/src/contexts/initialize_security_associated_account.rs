use crate::contexts::common::DISCRIMINATOR_LEN;

#[account]
#[derive(Default)]
pub struct SecurityAssociatedAccount {
  pub role: u8,
  pub group: Pubkey,
  pub holder: Pubkey,
}

impl SecurityAssociatedAccount {
  const ROLE_LEN: usize = mem::size_of::<u8>();
  const GROUP_LEN: usize = mem::size_of::<Pubkey>();
  const HOLDER_LEN: usize = mem::size_of::<Pubkey>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::ROLE_LEN
    + Self::GROUP_LEN
    + Self::HOLDER_LEN
  }
}

#[derive(Accounts)]
pub struct InitializeSecurityAssociatedAccount<'info> {
  #[account(init, payer = payer, space = Role::size())]
  pub role: Account<'info, Role>,
  pub group: AccountInfo<'info>,
  pub holder: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
