import { createHash } from 'crypto';
import { BOOKING_SHARD_COUNT } from './booking-shard.config';
import { getBookingShardPool } from './booking-db.manager';

/** All booking data for a flight maps to one shard and one locking domain. */
export const getBookingShardIndex = (flightId: string): number => {
    const hash = createHash('md5').update(flightId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % BOOKING_SHARD_COUNT;
};

export const getBookingShard = (flightId: string) =>
    getBookingShardPool(getBookingShardIndex(flightId));
