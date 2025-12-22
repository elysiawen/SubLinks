// Database interface types
export interface User {
    password: string;
    role: string;
    status: string;
    createdAt: number;
}

export interface Session {
    username: string;
    role: string;
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
    ip: string;
    ua: string;
    status: number;
    timestamp: number;
}

export interface WebAccessLog {
    id: string;
    path: string;
    ip: string;
    ua: string;
    username?: string;
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
}

export interface UpstreamSource {
    name: string;
    url: string;
    cacheDuration?: number; // Cache duration in hours
    uaWhitelist?: string[]; // UA whitelist
    isDefault?: boolean; // Mark as default source for new users/subscriptions
}

export interface GlobalConfig {
    upstreamUrl?: string | string[];
    upstreamSources?: UpstreamSource[];
    cacheDuration?: number;
    uaWhitelist?: string[];
    logRetentionDays?: number;
    maxUserSubscriptions?: number; // 0 means unlimited
    upstreamLastUpdated?: number; // Timestamp of last upstream refresh
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
    setUser(username: string, data: User): Promise<void>;
    deleteUser(username: string): Promise<void>;
    getAllUsers(): Promise<Array<User & { username: string }>>;
    userExists(username: string): Promise<boolean>;

    // Session operations
    createSession(sessionId: string, data: Session, ttl: number): Promise<void>;
    getSession(sessionId: string): Promise<Session | null>;
    deleteSession(sessionId: string): Promise<void>;

    // Subscription operations
    createSubscription(token: string, username: string, data: SubData): Promise<void>;
    getSubscription(token: string): Promise<(SubData & { token: string }) | null>;
    deleteSubscription(token: string, username: string): Promise<void>;
    updateSubscription(token: string, data: SubData): Promise<void>;
    getUserSubscriptions(username: string): Promise<Array<SubData & { token: string }>>;
    getAllSubscriptions(): Promise<Array<SubData & { token: string }>>;
    isSubscriptionOwner(username: string, token: string): Promise<boolean>;

    // Config operations
    getGlobalConfig(): Promise<GlobalConfig>;
    setGlobalConfig(data: GlobalConfig): Promise<void>;
    getCustomGroups(): Promise<ConfigSet[]>;
    getCustomGroup(id: string): Promise<ConfigSet | null>;
    saveCustomGroup(id: string | null, name: string, content: string): Promise<void>;
    deleteCustomGroup(id: string): Promise<void>;
    getCustomRules(): Promise<ConfigSet[]>;
    getCustomRule(id: string): Promise<ConfigSet | null>;
    saveCustomRule(id: string | null, name: string, content: string): Promise<void>;
    deleteCustomRule(id: string): Promise<void>;

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
    saveUpstreamConfigItem(key: string, value: any): Promise<void>;
    getUpstreamConfigItem(key: string): Promise<any>;
    getAllUpstreamConfig(): Promise<Record<string, any>>;

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

