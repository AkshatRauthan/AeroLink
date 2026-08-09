/**
 * Booking Service's own Redis key patterns and TTLs. 
 */
export const BookingCacheKeys = {
    // // Hash — per-seat status within a booking, updated independently per seat
    // seatAvailability: (bookingId: string) => `BOOKING_SERVICE::seats:${bookingId}`,

    // // String (JSON) — single object, read/written as a whole
    // bookingDetails: (bookingId: string) => `BOOKING_SERVICE::booking:${bookingId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (bookingId: string) => `BOOKING_SERVICE::pricefeed:${bookingId}`,
};

export const BookingCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // bookingDetails: 300, // 5 min — booking metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};