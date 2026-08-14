/**
 * Notification Service's own Redis key patterns and TTLs. 
 */
export const NotificationCacheKeys = {
    // // Hash — per-seat status within a notification, updated independently per seat
    // seatAvailability: (notificationId: string) => `NOTIFICATION_SERVICE::seats:${notificationId}`,

    // // String (JSON) — single object, read/written as a whole
    // notificationDetails: (notificationId: string) => `NOTIFICATION_SERVICE::notification:${notificationId}`,

    // // String — last known-good price snapshot, used as circuit breaker fallback
    // priceFeedSnapshot: (notificationId: string) => `NOTIFICATION_SERVICE::pricefeed:${notificationId}`,
};

export const NotificationCacheTTL = {
    // seatAvailability: 60, // seconds — short, seats change fast
    // notificationDetails: 300, // 5 min — notification metadata changes rarely
    // priceFeedSnapshot: 3600, // 1 hr — fallback should outlive a typical outage
};