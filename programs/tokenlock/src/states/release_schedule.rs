
use anchor_lang::prelude::*;
use solana_program::program_memory::sol_memcmp;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReleaseSchedule {
    pub release_count: u32,
    pub delay_until_first_release_in_seconds: u64,
    pub initial_release_portion_in_bips: u32,
    pub period_between_releases_in_seconds: u64,
    pub signer_hash: [u8; 20],
}

impl ReleaseSchedule {
    pub const DEFAULT_SIZE: usize = 4 + 8 + 4 + 8 + 20;

    pub fn is_equal(&self, src: &ReleaseSchedule) -> bool {
        //compare hash
        if sol_memcmp(&self.signer_hash, &src.signer_hash, 20) != 0 {
            return false;
        }

        return true;
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    fn create_release_schedule() -> ReleaseSchedule {
        return ReleaseSchedule {
            release_count: 4,
            delay_until_first_release_in_seconds: 3600,
            initial_release_portion_in_bips: 700,
            period_between_releases_in_seconds: 600,
            signer_hash: [0; 20],
        };
    }

    #[test]
    fn different_signer_hash() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            signer_hash: [255; 20],
            ..release_schedule1
        };

        assert!(
            !release_schedule1.is_equal(&release_schedule2),
            "release schedules are not equal when signer hash is different"
        )
    }

    #[test]
    fn different_release_count() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            release_count: release_schedule1.release_count + 1,
            ..release_schedule1
        };

        assert!(
            release_schedule1.is_equal(&release_schedule2),
            "release schedules are not equal when release count is different"
        )
    }

    #[test]
    fn different_delay_until_first_release_in_seconds() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            delay_until_first_release_in_seconds: release_schedule1
                .delay_until_first_release_in_seconds
                + 60,
            ..release_schedule1
        };

        assert!(
        release_schedule1.is_equal(&release_schedule2),
        "release schedules are not equal when delay until first release in seconds is different"
    )
    }

    #[test]
    fn different_initial_release_portion_in_bips() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            initial_release_portion_in_bips: 0,
            ..release_schedule1
        };

        assert!(
            release_schedule1.is_equal(&release_schedule2),
            "release schedules are not equal when initial release portion in bips is different"
        )
    }

    #[test]
    fn different_period_between_releases_in_seconds() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            period_between_releases_in_seconds: 0,
            ..release_schedule1
        };

        assert!(
            release_schedule1.is_equal(&release_schedule2),
            "release schedules are not equal when period between releases in seconds is different"
        )
    }

    #[test]
    fn equal_release_schedules() {
        let release_schedule1 = create_release_schedule();
        let release_schedule2 = ReleaseSchedule {
            ..release_schedule1
        };

        assert!(
            release_schedule1.is_equal(&release_schedule2),
            "release schedules must be equal"
        )
    }
}
