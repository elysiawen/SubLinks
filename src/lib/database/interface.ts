// Database interface types

// UA Filter Types
export type UaMatchType = 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'exact';
export type UaFilterMode = 'blacklist' | 'whitelist';

export interface UaRule {
    pattern: string;           // Match pattern
    matchType: UaMatchType;    // Match type
    description?: string;      // Rule description
}

export interface UaFilterConfig {
    mode: UaFilterMode;        // Blacklist or whitelist mode
    rules: UaRule[];           // Rule list
    enabled: boolean;          // Whether enabled
}
export interface User {
    id: string;          // UUID - primary identifier
    username: string;    // Used for login
    password: string;
    role: string;
    status: string;
    maxSubscriptions: number | null; // null = follow global, number = custom limit
    tokenVersion?: number; // Incremented on password change to invalidate tokens
    nickname?: string;   // Display name (optional)
    avatar?: string;     // Avatar URL (optional)
    createdAt: number;
}

export interface Session {
    userId: string;      // UUID reference to User
    username: string;    // Kept for backward compatibility
    role: string;
    tokenVersion?: number; // Token version for invalidation
    nickname?: string;   // Display name (optional)
    avatar?: string;     // Avatar URL (optional)
    ip?: string;         // IP address
    ipLocation?: string; // IP Location
    isp?: string;        // ISP Name
    ua?: string;         // User Agent
    deviceInfo?: string; // Parsed device info
    lastActive?: number; // Last active timestamp
}

export interface RefreshToken {
    id: string;          // UUID/nanoid
    userId: string;
    username: string;
    token: string;       // Hashed token or JTI
    ip?: string;
    ua?: string;
    deviceInfo?: string; // e.g., "Chrome on Windows"
    createdAt: number;
    expiresAt: number;
    lastActive: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
}

export interface SubData {
    username: string;
    remark: string;
    customRules: string;
    groupId?: string;
    ruleId?: string;
    selectedSources?: string[]; // User-selected upstream sources
    enabled: boolean;
    createdAt: number;
}

export interface APIAccessLog {
    id: string;
    token: string;
    username: string;
    nickname?: string;       // User's display name
    ip: string;
    ua: string;
    status: number;
    timestamp: number;
    apiType?: string;        // e.g., "订阅API请求", "刷新API请求"
    requestMethod?: string;  // e.g., "GET (Bearer)", "POST", "GET (?key=)"
}

export interface WebAccessLog {
    id: string;
    path: string;
    ip: string;
    ua: string;
    username?: string;
    nickname?: string;       // User's display name
    status: number;
    timestamp: number;
}

export interface SystemLog {
    id: string;
    category: 'system' | 'update' | 'error';
    message: string;
    details?: any;
    status: 'success' | 'failure';
    timestamp: number;
}

export interface ConfigSet {
    id: string;
    name: string;
    content: string;
    updatedAt: number;
    userId?: string;      // Owner of this config set
    isGlobal?: boolean;   // If true, visible to all users
    username?: string;    // Username of the owner (for admin display)
}

export interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number; // Cache duration in hours

    isDefault?: boolean; // Mark as default source for new users/subscriptions
    lastUpdated?: number; // Timestamp of last refresh
    status?: 'pending' | 'success' | 'failure'; // Status of last refresh
    error?: string; // Error message if failed
    traffic?: {
        upload: number;
        download: number;
        total: number;
        expire: number;
    };
}

export interface GlobalConfig {
    // Core settings with defaults
    maxUserSubscriptions: number; // Default: 10
    logRetentionDays: number; // Default: 30

    // Optional settings

    refreshApiKey?: string;
    upstreamLastUpdated?: number;
    announcement?: string; // Homepage announcement in Markdown format
    updatedAt?: number;
    upstreamUserAgent?: string; // Custom User-Agent for fetching upstream
    customBackgroundUrl?: string; // Custom background image URL for root page

    // Storage configuration
    storageProvider?: 'local' | 's3'; // Default: 'local'
    localStoragePath?: string; // Default: '/uploads/avatars'

    // Unified S3 configuration (supports R2, Tigris, AWS S3, MinIO, etc.)
    s3Preset?: 'cloudflare-r2' | 'tigris' | 'aws-s3' | 'minio' | 'custom';
    s3Endpoint?: string;
    s3Region?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
    s3BucketName?: string;
    s3PublicDomain?: string;
    s3FolderPath?: string; // Default: 'avatars'
    s3AccountId?: string; // For R2 endpoint construction

    // New UA filtering configuration
    uaFilter?: UaFilterConfig;  // Global UA filter config
}

// Structured upstream data types
export interface Proxy {
    id: string;
    name: string;
    type: string;
    server?: string;
    port?: number;
    config: any; // Full proxy configuration as JSON
    source: string; // 'upstream' or 'custom'
    createdAt: number;
}

export interface ProxyGroup {
    id: string;
    name: string;
    type: string;
    proxies: string[]; // Array of proxy/group names
    config: any; // Additional config (url, interval, etc.)
    source: string;
    priority: number;
    createdAt: number;
}

export interface Rule {
    id: string;
    ruleText: string;
    priority: number;
    source: string;
    createdAt: number;
}

// Database interface
export interface IDatabase {
    // User operations
    getUser(username: string): Promise<User | null>;
    getUserById(id: string): Promise<User | null>;  // New: Get user by UUID
    setUser(username: string, data: User): Promise<void>;
    deleteUser(username: string): Promise<void>;
    getAllUsers(page?: number, limit?: number, search?: string): Promise<PaginatedResult<User & { username: string }>>;
    userExists(username: string): Promise<boolean>;

    // Session operations
    createSession(sessionId: string, data: Session, ttl: number): Promise<void>;
    getSession(sessionId: string, currentIp?: string): Promise<Session | null>;
    deleteSession(sessionId: string): Promise<void>; // Delete by Session ID
    deleteUserSession(userId: string, sessionId: string): Promise<void>; // Delete by UserID + SessionID (Security)
    getUserSessions(userId: string): Promise<Session[]>; // Get all web sessions for user
    getAllSessions(page?: number, limit?: number, search?: string): Promise<PaginatedResult<Session & { sessionId: string }>>; // Admin: Get all sessions
    deleteAllUserSessions(userId: string): Promise<void>; // Delete ALL web sessions for a user
    cleanupExpiredSessions(): Promise<number>; // Returns count of deleted sessions

    // Refresh Token operations (Client Sessions)
    createRefreshToken(token: RefreshToken): Promise<void>;
    getRefreshToken(tokenString: string): Promise<RefreshToken | null>;
    deleteRefreshToken(tokenString: string): Promise<void>; // Delete by token string
    deleteRefreshTokenById(id: string): Promise<void>; // Delete by UUID
    deleteUserRefreshToken(userId: string, tokenId: string): Promise<void>; // Delete by ID (Revoke)
    deleteAllUserRefreshTokens(userId: string): Promise<void>; // Delete ALL refresh tokens for a user
    getUserRefreshTokens(userId: string): Promise<RefreshToken[]>;
    getAllRefreshTokens(page?: number, limit?: number, search?: string): Promise<PaginatedResult<RefreshToken>>; // Admin: Get all refresh tokens
    cleanupExpiredRefreshTokens(): Promise<number>;

    // Subscription operations
    createSubscription(token: string, username: string, data: SubData): Promise<void>;
    getSubscription(token: string): Promise<(SubData & { token: string }) | null>;
    deleteSubscription(token: string, username: string): Promise<void>;
    updateSubscription(token: string, data: SubData): Promise<void>;
    getUserSubscriptions(username: string): Promise<Array<SubData & { token: string }>>;
    getAllSubscriptions(page?: number, limit?: number, search?: string): Promise<PaginatedResult<SubData & { token: string }>>;
    isSubscriptionOwner(username: string, token: string): Promise<boolean>;

    // Config operations
    getGlobalConfig(): Promise<GlobalConfig>;
    setGlobalConfig(data: GlobalConfig): Promise<void>;
    // User-scoped methods - returns user's own + global configs
    getCustomGroups(userId: string): Promise<ConfigSet[]>;
    getCustomGroup(id: string, userId: string): Promise<ConfigSet | null>;
    saveCustomGroup(id: string | null, userId: string, name: string, content: string, isGlobal?: boolean): Promise<void>;
    deleteCustomGroup(id: string, userId: string): Promise<void>;
    getCustomRules(userId: string): Promise<ConfigSet[]>;
    getCustomRule(id: string, userId: string): Promise<ConfigSet | null>;
    saveCustomRule(id: string | null, userId: string, name: string, content: string, isGlobal?: boolean): Promise<void>;
    deleteCustomRule(id: string, userId: string): Promise<void>;

    // Admin methods - returns all configs
    getAllCustomGroups(): Promise<ConfigSet[]>;
    getAllCustomRules(): Promise<ConfigSet[]>;

    // Upstream source operations
    getUpstreamSources(): Promise<UpstreamSource[]>;
    getUpstreamSource(name: string): Promise<UpstreamSource | null>;
    getUpstreamSourceByName(name: string): Promise<UpstreamSource | null>; // Alias for getUpstreamSource
    createUpstreamSource(source: UpstreamSource): Promise<void>;
    updateUpstreamSource(name: string, source: Partial<UpstreamSource>): Promise<void>;
    deleteUpstreamSource(name: string): Promise<void>;
    setDefaultUpstreamSource(name: string): Promise<void>;

    // Cache operations
    getCache(key: string): Promise<string | null>;
    setCache(key: string, value: string, ttl?: number): Promise<void>;
    deleteCache(key: string): Promise<void>;
    clearAllSubscriptionCaches(): Promise<void>; // Clear all cache:subscription:* entries

    // Structured upstream data operations
    // Proxies
    saveProxies(proxies: Proxy[]): Promise<void>;
    getProxies(source?: string): Promise<Proxy[]>;
    clearProxies(source: string): Promise<void>;

    // Proxy Groups
    saveProxyGroups(groups: ProxyGroup[]): Promise<void>;
    getProxyGroups(source?: string): Promise<ProxyGroup[]>;
    clearProxyGroups(source: string): Promise<void>;

    // Rules
    saveRules(rules: Rule[]): Promise<void>;
    getRules(source?: string): Promise<Rule[]>;
    clearRules(source: string): Promise<void>;

    // Upstream Config
    saveUpstreamConfigItem(key: string, value: any, source?: string): Promise<void>;
    getUpstreamConfigItem(key: string): Promise<any>;
    getAllUpstreamConfig(): Promise<Record<string, any>>; // Returns raw config (including suffixed keys)
    getUpstreamConfig(sources?: string[]): Promise<Record<string, any>>; // Returns merged config for selected sources

    // Logs
    createAPIAccessLog(log: Omit<APIAccessLog, 'id'>): Promise<void>;
    getAPIAccessLogs(limit: number, offset: number, search?: string): Promise<APIAccessLog[]>;

    createWebAccessLog(log: Omit<WebAccessLog, 'id'>): Promise<void>;
    getWebAccessLogs(limit: number, offset: number, search?: string): Promise<WebAccessLog[]>;

    createSystemLog(log: Omit<SystemLog, 'id'>): Promise<void>;
    getSystemLogs(limit: number, offset: number, search?: string): Promise<SystemLog[]>;

    // Maintenance
    cleanupLogs(retentionDays: number): Promise<void>;
    deleteAllLogs(): Promise<void>;
}

