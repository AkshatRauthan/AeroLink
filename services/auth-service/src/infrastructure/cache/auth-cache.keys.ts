import { AuthCacheTTLConfig } from "@root/config"

/**
 * Auth Service's own Redis key patterns and TTLs. 
 */
export const AuthCacheKeys = {
    // Sessions Black-Listing:
    blacklistedSession: (sessionId: string) => `AUTH_SERVICE::blacklist:session:${sessionId}`,

    // Email/phoneNo -> userId: Reverse lookup
    userIdByEmail: (email: string) => `AUTH_SERVICE::lookup:email:${email}`,
    userIdByPhone: (phoneNo: string) => `AUTH_SERVICE::lookup:phone:${phoneNo}`,

    // UserId -> Sessions: Sorted Set
    userSessions: (userId: string) => `AUTH_SERVICE::sessions:${userId}`,
};

export const AuthCacheTTL = {
    // Sessions Black-Listing:
    blacklistedSessionTTL: AuthCacheTTLConfig.AuthBlacklistTTL,

    // Email/phoneNo -> userId: Reverse lookup
    userIdByEmailTTL: AuthCacheTTLConfig.UserSessionsLookupTTL,
    userIdByPhoneTTL: AuthCacheTTLConfig.UserSessionsLookupTTL,

    // UserId -> Sessions: Sorted Set
    userSessionTTL: AuthCacheTTLConfig.UserSessionsLookupTTL,
};