import { getPositiveInteger } from '@aerolink/shared';

interface ICleanupConfig {
    DB_CLEANUP_PERIOD: number;

    DB_CLEANUP_MAX_BATCH_SIZE: number;
    DB_CLEANUP_GRACE_PERIOD_SECONDS: number;
}

const cleanupConfig: ICleanupConfig = {
    DB_CLEANUP_PERIOD: getPositiveInteger("DB_CLEANUP_PERIOD", "604800"),

    DB_CLEANUP_MAX_BATCH_SIZE: getPositiveInteger("DB_CLEANUP_MAX_BATCH_SIZE", "1000"),
    DB_CLEANUP_GRACE_PERIOD_SECONDS: getPositiveInteger("DB_CLEANUP_GRACE_PERIOD_SECONDS", "604800"),
}

export default cleanupConfig;