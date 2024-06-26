use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    token_metadata_initialize, Mint, Token2022, TokenMetadataInitialize,
};
use num_enum::IntoPrimitive;

use crate::contexts::common::DISCRIMINATOR_LEN;

pub const ACCESS_CONTROL_SEED: &[u8] = b"ac"; // access_control

#[repr(u8)]
#[derive(IntoPrimitive, AnchorDeserialize, AnchorSerialize, Clone, InitSpace, Copy, Debug)]
pub enum Roles {
    ContractAdmin = 1,  // 0001
    ReserveAdmin = 2,   // 0010
    WalletsAdmin = 4,    // 0100
    TransferAdmin = 8,  // 1000
    All = 15,           // 1000
}

pub const ADMIN_ROLES: u8 = Roles::ContractAdmin as u8
    | Roles::ReserveAdmin as u8
    | Roles::WalletsAdmin as u8
    | Roles::TransferAdmin as u8;

#[account()]
#[derive(InitSpace)]
pub struct AccessControl {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub max_total_supply: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeAccessControlArgs {
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub hook_program_id: Pubkey,
    pub max_total_supply: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeAccessControlArgs)]
pub struct InitializeAccessControl<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account()]
    /// CHECK: can be any account
    pub authority: UncheckedAccount<'info>,

    #[account(
      init,
      signer,
      payer = payer,
      mint::token_program = token_program,
      mint::decimals = args.decimals,
      mint::authority = access_control.key(),
      mint::freeze_authority = access_control.key(),
      extensions::transfer_hook::authority = authority,
      extensions::transfer_hook::program_id = args.hook_program_id,
      extensions::group_member_pointer::authority = access_control.key(),
      extensions::group_member_pointer::member_address = mint,
      extensions::group_pointer::authority = access_control.key(),
      extensions::group_pointer::group_address = mint,
      extensions::metadata_pointer::authority = access_control.key(),
      extensions::metadata_pointer::metadata_address = mint,
      extensions::permanent_delegate::delegate = access_control.key(),
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AccessControl::INIT_SPACE,
      seeds = [
        ACCESS_CONTROL_SEED,
        mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control: Box<Account<'info, AccessControl>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> InitializeAccessControl<'info> {
    pub fn initialize_token_metadata(
        &self,
        program_id: &Pubkey,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let cpi_accounts = TokenMetadataInitialize {
            token_program_id: self.token_program.to_account_info(),
            mint: self.mint.to_account_info(),
            metadata: self.mint.to_account_info(), // metadata account is the mint, since data is stored in mint
            mint_authority: self.access_control.to_account_info(),
            update_authority: self.access_control.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        let mint = self.mint.key();
        let (_pda, bump_seed) =
            Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.as_ref()], program_id);

        let seeds = &[ACCESS_CONTROL_SEED, mint.as_ref(), &[bump_seed]];

        token_metadata_initialize(cpi_ctx.with_signer(&[&seeds[..]]), name, symbol, uri)?;

        Ok(())
    }
}
