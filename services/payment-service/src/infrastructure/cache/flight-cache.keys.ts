/**
 * Payment Service's own Redis key patterns and TTLs. 
 */
export const PaymentCacheKeys = {
    // // Hash — per-seat status within a payment, updated independently per seat
    // seatAvailability: (paymentId: string) => `PAYMENT_SERVICE::seats:${paymentId}`,

    // // String (JSON) — single object, read/written as a whole
    // paymentDetails: (paymentId: string) => `PAYMENT_SERVICE::payment:${paymentId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (paymentId: string) => `PAYMENT_SERVICE::pricefeed:${paymentId}`,
};

export const PaymentCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // paymentDetails: 300, // 5 min — payment metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};