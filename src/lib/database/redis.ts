import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { IDatabase, User, Session, SubData, ConfigSet, GlobalConfig, Proxy, ProxyGroup, Rule } from './interface';
import { nanoid } from 'nanoid';

export default class RedisDatabase implements IDatabase {
    private redis: Redis;

    constructor() {
        this.redis = this.getRedisClient();
    }

    private getRedisClient(): Redis {
        // Development fallback to mock
        if (!process.env.REDIS_URL && process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  Redis: No REDIS_URL found. Using in-memory mock. Data will be lost on restart.');
            return new RedisMock() as unknown as Redis;
        }

        // Production or explicit URL
        if (!process.env.REDIS_URL) {
            throw new Error('REDIS_URL environment variable is required for Redis database');
        }

        return new Redis(process.env.REDIS_URL);
    }

    // User operations
    async getUser(username: string): Promise<User | null> {
        const data = await this.redis.get(`user:${username}`);
        return data ? JSON.parse(data) : null;
    }

    async setUser(username: string, data: User): Promise<void> {
        await this.redis.set(`user:${username}`, JSON.stringify(data));
        await this.redis.sadd('users:index', username);
    }

    async deleteUser(username: string): Promise<void> {
        await this.redis.del(`user:${username}`);
        await this.redis.srem('users:index', username);
    }

    async getAllUsers(): Promise<Array<User & { username: string }>> {
        const usernames = await this.redis.smembers('users:index');
        if (!usernames || usernames.length === 0) return [];

        const users = await Promise.all(
            usernames.map(async (username) => {
                const data = await this.redis.get(`user:${username}`);
                if (!data) return null;
                return { username, ...JSON.parse(data) };
            })
        );

        return users.filter((u) => u !== null) as Array<User & { username: string }>;
    }

    async userExists(username: string): Promise<boolean> {
        return (await this.redis.exists(`user:${username}`)) === 1;
    }

    // Session operations
    async createSession(sessionId: string, data: Session, ttl: number): Promise<void> {
        await this.redis.set(`session:${sessionId}`, JSON.stringify(data), 'EX', ttl);
    }

    async getSession(sessionId: string): Promise<Session | null> {
        const data = await this.redis.get(`session:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.redis.del(`session:${sessionId}`);
    }

    // Subscription operations
    async createSubscription(token: string, username: string, data: SubData): Promise<void> {
        await this.redis.set(`sub:${token}`, JSON.stringify(data));
        await this.redis.sadd(`user:${username}:subs`, token);
    }

    async getSubscription(token: string): Promise<(SubData & { token: string }) | null> {
        const data = await this.redis.get(`sub:${token}`);
        return data ? { token, ...JSON.parse(data) } : null;
    }

    async deleteSubscription(token: string, username: string): Promise<void> {
        await this.redis.del(`sub:${token}`);
        await this.redis.srem(`user:${username}:subs`, token);
    }

    async updateSubscription(token: string, data: SubData): Promise<void> {
        await this.redis.set(`sub:${token}`, JSON.stringify(data));
    }

    async getUserSubscriptions(username: string): Promise<Array<SubData & { token: string }>> {
        const tokens = await this.redis.smembers(`user:${username}:subs`);
        if (!tokens || tokens.length === 0) return [];

        const subs = await Promise.all(
            tokens.map(async (token) => {
                const data = await this.redis.get(`sub:${token}`);
                return data ? { token, ...JSON.parse(data) } : null;
            })
        );

        return subs.filter((s) => s !== null) as Array<SubData & { token: string }>;
    }

    async getAllSubscriptions(): Promise<Array<SubData & { token: string }>> {
        const keys = await this.redis.keys('sub:*');
        if (!keys || keys.length === 0) return [];

        const subs = await Promise.all(
            keys.map(async (key) => {
                const token = key.replace('sub:', '');
                const data = await this.redis.get(key);
                return data ? { token, ...JSON.parse(data) } : null;
            })
        );

        return (subs.filter((s) => s !== null) as Array<SubData & { token: string }>)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    async isSubscriptionOwner(username: string, token: string): Promise<boolean> {
        return (await this.redis.sismember(`user:${username}:subs`, token)) === 1;
    }

    // Config operations
    async getGlobalConfig(): Promise<GlobalConfig> {
        const data = await this.redis.get('config:global');
        return data ? JSON.parse(data) : {};
    }

    async setGlobalConfig(data: GlobalConfig): Promise<void> {
        await this.redis.set('config:global', JSON.stringify(data));
    }

    async getCustomGroups(): Promise<ConfigSet[]> {
        const keys = await this.redis.keys('custom:groups:*');
        if (keys.length === 0) return [];

        const sets = await Promise.all(
            keys.map(async (key) => {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) : null;
            })
        );

        return sets.filter((s) => s !== null) as ConfigSet[];
    }

    async getCustomGroup(id: string): Promise<ConfigSet | null> {
        const data = await this.redis.get(`custom:groups:${id}`);
        return data ? JSON.parse(data) : null;
    }

    async saveCustomGroup(id: string | null, name: string, content: string): Promise<void> {
        const newId = id || nanoid(8);
        const data: ConfigSet = {
            id: newId,
            name,
            content,
            updatedAt: Date.now(),
        };
        await this.redis.set(`custom:groups:${newId}`, JSON.stringify(data));
    }

    async deleteCustomGroup(id: string): Promise<void> {
        await this.redis.del(`custom:groups:${id}`);
    }

    async getCustomRules(): Promise<ConfigSet[]> {
        const keys = await this.redis.keys('custom:rules:*');
        if (keys.length === 0) return [];

        const sets = await Promise.all(
            keys.map(async (key) => {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) : null;
            })
        );

        return sets.filter((s) => s !== null) as ConfigSet[];
    }

    async getCustomRule(id: string): Promise<ConfigSet | null> {
        const data = await this.redis.get(`custom:rules:${id}`);
        return data ? JSON.parse(data) : null;
    }

    async saveCustomRule(id: string | null, name: string, content: string): Promise<void> {
        const newId = id || nanoid(8);
        const data: ConfigSet = {
            id: newId,
            name,
            content,
            updatedAt: Date.now(),
        };
        await this.redis.set(`custom:rules:${newId}`, JSON.stringify(data));
    }

    async deleteCustomRule(id: string): Promise<void> {
        await this.redis.del(`custom:rules:${id}`);
    }

    // Cache operations
    async getCache(key: string): Promise<string | null> {
        return await this.redis.get(key);
    }

    async setCache(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.redis.set(key, value, 'EX', ttl);
        } else {
            await this.redis.set(key, value);
        }
    }

    async deleteCache(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async clearAllSubscriptionCaches(): Promise<void> {
        // Get all keys matching the pattern
        const keys = await this.redis.keys('cache:subscription:*');
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }

    // Structured upstream data operations
    // Proxies
    async saveProxies(proxies: Proxy[]): Promise<void> {
        if (proxies.length === 0) return;

        // Use pipeline for batch operations
        const pipeline = this.redis.pipeline();

        for (const proxy of proxies) {
            pipeline.hset(`proxies:${proxy.source}`, proxy.id, JSON.stringify(proxy));
        }

        await pipeline.exec();
    }

    async getProxies(source?: string): Promise<Proxy[]> {
        if (source) {
            const data = await this.redis.hgetall(`proxies:${source}`);
            return Object.values(data).map(v => JSON.parse(v));
        }

        // Get all sources
        const keys = await this.redis.keys('proxies:*');
        if (keys.length === 0) return [];

        const allProxies: Proxy[] = [];
        for (const key of keys) {
            const data = await this.redis.hgetall(key);
            allProxies.push(...Object.values(data).map(v => JSON.parse(v)));
        }

        return allProxies.sort((a, b) => a.createdAt - b.createdAt);
    }

    async clearProxies(source: string): Promise<void> {
        await this.redis.del(`proxies:${source}`);
    }

    // Proxy Groups
    async saveProxyGroups(groups: ProxyGroup[]): Promise<void> {
        if (groups.length === 0) return;

        const pipeline = this.redis.pipeline();

        for (const group of groups) {
            pipeline.hset(`proxy_groups:${group.source}`, group.id, JSON.stringify(group));
        }

        await pipeline.exec();
    }

    async getProxyGroups(source?: string): Promise<ProxyGroup[]> {
        if (source) {
            const data = await this.redis.hgetall(`proxy_groups:${source}`);
            const groups = Object.values(data).map(v => JSON.parse(v));
            return groups.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
        }

        const keys = await this.redis.keys('proxy_groups:*');
        if (keys.length === 0) return [];

        const allGroups: ProxyGroup[] = [];
        for (const key of keys) {
            const data = await this.redis.hgetall(key);
            allGroups.push(...Object.values(data).map(v => JSON.parse(v)));
        }

        return allGroups.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    }

    async clearProxyGroups(source: string): Promise<void> {
        await this.redis.del(`proxy_groups:${source}`);
    }

    // Rules - Store as single JSON array for performance (10,000+ rules)
    async saveRules(rules: Rule[]): Promise<void> {
        if (rules.length === 0) return;

        // Group by source
        const rulesBySource: Record<string, Rule[]> = {};
        for (const rule of rules) {
            if (!rulesBySource[rule.source]) {
                rulesBySource[rule.source] = [];
            }
            rulesBySource[rule.source].push(rule);
        }

        // Store each source as a single JSON array
        const pipeline = this.redis.pipeline();
        for (const [source, sourceRules] of Object.entries(rulesBySource)) {
            pipeline.set(`rules:${source}`, JSON.stringify(sourceRules));
        }
        await pipeline.exec();
    }

    async getRules(source?: string): Promise<Rule[]> {
        if (source) {
            const data = await this.redis.get(`rules:${source}`);
            if (!data) return [];
            const rules = JSON.parse(data) as Rule[];
            return rules.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
        }

        // Get all sources
        const keys = await this.redis.keys('rules:*');
        if (keys.length === 0) return [];

        const allRules: Rule[] = [];
        for (const key of keys) {
            const data = await this.redis.get(key);
            if (data) {
                allRules.push(...JSON.parse(data));
            }
        }

        return allRules.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    }

    async clearRules(source: string): Promise<void> {
        await this.redis.del(`rules:${source}`);
    }

    // Upstream Config
    async saveUpstreamConfigItem(key: string, value: any): Promise<void> {
        await this.redis.hset('upstream:config', key, JSON.stringify(value));
    }

    async getUpstreamConfigItem(key: string): Promise<any> {
        const data = await this.redis.hget('upstream:config', key);
        return data ? JSON.parse(data) : null;
    }

    async getAllUpstreamConfig(): Promise<Record<string, any>> {
        const data = await this.redis.hgetall('upstream:config');
        const config: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            config[key] = JSON.parse(value);
        }
        return config;
    }

    // Logs - Use Redis Lists for simple time-ordered logs
    private async pushLog(key: string, log: any): Promise<void> {
        await this.redis.lpush(key, JSON.stringify(log));
        // Keep last 10000 logs to prevent memory exhaustion
        await this.redis.ltrim(key, 0, 9999);
    }

    private async getLogs<T>(key: string, limit: number, offset: number, search?: string, searchFields?: (keyof T)[]): Promise<T[]> {
        if (!search) {
            const data = await this.redis.lrange(key, offset, offset + limit - 1);
            return data.map(item => JSON.parse(item));
        }

        // Search implementation: Fetch all logs (capped) and filter in memory
        // This is not efficient for huge datasets but acceptable for this use case (<10k logs)
        const allData = await this.redis.lrange(key, 0, -1);
        const filtered = allData
            .map(item => JSON.parse(item) as T)
            .filter(log => {
                if (!searchFields) return true;
                const searchLower = search.toLowerCase();
                return searchFields.some(field => {
                    const val = log[field];
                    return String(val || '').toLowerCase().includes(searchLower);
                });
            });

        return filtered.slice(offset, offset + limit);
    }

    async createAPIAccessLog(log: Omit<import('./interface').APIAccessLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pushLog('logs:api', { id, ...log });
    }

    async getAPIAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').APIAccessLog[]> {
        return this.getLogs('logs:api', limit, offset, search, ['token', 'username', 'ip', 'ua']);
    }

    async createWebAccessLog(log: Omit<import('./interface').WebAccessLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pushLog('logs:web', { id, ...log });
    }

    async getWebAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').WebAccessLog[]> {
        return this.getLogs('logs:web', limit, offset, search, ['path', 'ip', 'username', 'ua']);
    }

    async createSystemLog(log: Omit<import('./interface').SystemLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pushLog('logs:system', { id, ...log });
    }

    async getSystemLogs(limit: number, offset: number, search?: string): Promise<import('./interface').SystemLog[]> {
        return this.getLogs('logs:system', limit, offset, search, ['message', 'category']);
    }

    async cleanupLogs(retentionDays: number): Promise<void> {
        // Redis uses capped lists (MAX_LOGS), so time-based retention is implicitly handled by capacity.
        // Implementing precise time-based cleanup for Lists is inefficient.
        // If strictly required, we could scan the list, but for now we rely on the 10k limit.
        return;
    }

    async deleteAllLogs(): Promise<void> {
        await this.redis.del('logs:api', 'logs:web', 'logs:system');
    }
}
