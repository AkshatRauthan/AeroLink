/**
 * Single source of truth for every Redis key pattern used across all services.
 * Adding a new type of cached data = add one line here, nothing else in
 * this folder needs to change.
 */
export const CacheKeys = {
    // Hash — per-seat status within a flight, updated independently per seat
    seatAvailability: (flightId: string) => `seats:${flightId}`,

    // String (JSON) — single object, read/written as a whole
    flightDetails: (flightId: string) => `flight:${flightId}`,

    // Sorted set — user's bookings ordered by booking timestamp
    userBookingHistory: (userId: string) => `bookings:user:${userId}`,

    // String — last known-good price snapshot, used as circuit breaker fallback
    priceFeedSnapshot: (flightId: string) => `pricefeed:${flightId}`,

    // String with INCR — IP-based rate limiting counter at the gateway
    rateLimitByIp: (ip: string, windowStart: number) => `ratelimit:ip:${ip}:${windowStart}`,

    // String with INCR — path-based rate limiting counter at the gateway
    rateLimitByPath: (path: string, windowStart: number) => `ratelimit:path:${path}:${windowStart}`,
};

export const CacheTTL = {
    seatAvailability: 60,      // seconds — short, seats change fast
    flightDetails: 300,        // 5 min — flight metadata changes rarely
    userBookingHistory: 600,   // 10 min
    priceFeedSnapshot: 3600,   // 1 hr — fallback should outlive a typical outage
    rateLimitWindow: 60,       // matches the rate limit window size
};