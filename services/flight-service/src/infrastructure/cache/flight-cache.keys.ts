/**
 * Flight Service's own Redis key patterns and TTLs. 
 */
export const FlightCacheKeys = {
    // // Hash — per-seat status within a flight, updated independently per seat
    // seatAvailability: (flightId: string) => `FLIGHT_SERVICE::seats:${flightId}`,

    // // String (JSON) — single object, read/written as a whole
    // flightDetails: (flightId: string) => `FLIGHT_SERVICE::flight:${flightId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (flightId: string) => `FLIGHT_SERVICE::pricefeed:${flightId}`,
};

export const FlightCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // flightDetails: 300, // 5 min — flight metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};