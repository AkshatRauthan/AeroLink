/**
 * Gateway Service's own Redis key patterns and TTLs. 
 */
export const GatewayCacheKeys = {
    // // Hash — per-seat status within a gateway, updated independently per seat
    // seatAvailability: (gatewayId: string) => `GATEWAY_SERVICE::seats:${gatewayId}`,

    // // String (JSON) — single object, read/written as a whole
    // gatewayDetails: (gatewayId: string) => `GATEWAY_SERVICE::gateway:${gatewayId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (gatewayId: string) => `GATEWAY_SERVICE::pricefeed:${gatewayId}`,
};

export const GatewayCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // gatewayDetails: 300, // 5 min — gateway metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};