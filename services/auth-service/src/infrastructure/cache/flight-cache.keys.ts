/**
 * Auth Service's own Redis key patterns and TTLs. 
 */
export const AuthCacheKeys = {
    // // Hash — per-seat status within a auth, updated independently per seat
    // seatAvailability: (authId: string) => `AUTH_SERVICE::seats:${authId}`,

    // // String (JSON) — single object, read/written as a whole
    // authDetails: (authId: string) => `AUTH_SERVICE::auth:${authId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (authId: string) => `AUTH_SERVICE::pricefeed:${authId}`,
};

export const AuthCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // authDetails: 300, // 5 min — auth metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};