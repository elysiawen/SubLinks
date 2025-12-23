import { Pool, PoolClient } from 'pg';
import { IDatabase, User, Session, SubData, ConfigSet, GlobalConfig, Proxy, ProxyGroup, Rule } from './interface';
import { nanoid } from 'nanoid';

export default class PostgresDatabase implements IDatabase {
    private pool: Pool;
    private initialized: boolean = false;

    constructor() {
        if (!process.env.POSTGRES_URL) {
            throw new Error('POSTGRES_URL environment variable is required for PostgreSQL database');
        }

        this.pool = new Pool({
            connectionString: process.env.POSTGRES_URL,
            ssl: {
                rejectUnauthorized: false // Accept self-signed certificates
            }
        });
    }

    private async ensureInitialized() {
        if (this.initialized) return;

        try {
            await this.initTables();
            this.initialized = true;
        } catch (err) {
            console.error('Failed to initialize PostgreSQL tables:', err);
            // Don't throw - allow retry on next call
        }
    }

    private async initTables() {
        const client = await this.pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS global_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS users (
                    username VARCHAR(255) PRIMARY KEY,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    created_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS subscriptions (
                    token VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    remark VARCHAR(255),
                    group_id VARCHAR(255),
                    rule_id VARCHAR(255),
                    custom_rules TEXT,
                    selected_sources JSONB,
                    enabled BOOLEAN DEFAULT TRUE,
                    created_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_subscriptions_username ON subscriptions(username);

                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    created_at BIGINT NOT NULL DEFAULT 0,
                    expires_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

                CREATE TABLE IF NOT EXISTS cache (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL,
                    expires_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

                CREATE TABLE IF NOT EXISTS proxies (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    server VARCHAR(255),
                    port INTEGER,
                    config JSONB NOT NULL,
                    source VARCHAR(255) NOT NULL,
                    created_at BIGINT NOT NULL DEFAULT 0,
                    data JSONB -- Keep for compatibility if needed, though config is essentially data
                );
                CREATE INDEX IF NOT EXISTS idx_proxies_source ON proxies(source);

                CREATE TABLE IF NOT EXISTS proxy_groups (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    proxies JSONB NOT NULL,
                    config JSONB NOT NULL,
                    source VARCHAR(255) NOT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    created_at BIGINT NOT NULL DEFAULT 0,
                    data JSONB
                );
                CREATE INDEX IF NOT EXISTS idx_proxy_groups_source ON proxy_groups(source);

                CREATE TABLE IF NOT EXISTS rules (
                    id VARCHAR(255) PRIMARY KEY,
                    source VARCHAR(255) NOT NULL,
                    rule_text JSONB NOT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    created_at BIGINT NOT NULL DEFAULT 0,
                    data JSONB -- Keep for compatibility
                );
                CREATE INDEX IF NOT EXISTS idx_rules_source ON rules(source);

                CREATE TABLE IF NOT EXISTS upstream_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value JSONB NOT NULL
                );

                CREATE TABLE IF NOT EXISTS custom_groups (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS custom_rules (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS api_access_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    token VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    ip VARCHAR(255) NOT NULL,
                    ua TEXT NOT NULL,
                    status INTEGER NOT NULL,
                    timestamp BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_api_logs_token ON api_access_logs(token);
                CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_access_logs(timestamp);

                CREATE TABLE IF NOT EXISTS web_access_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    path VARCHAR(255) NOT NULL,
                    ip VARCHAR(255) NOT NULL,
                    ua TEXT NOT NULL,
                    username VARCHAR(255),
                    status INTEGER NOT NULL,
                    timestamp BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_web_logs_timestamp ON web_access_logs(timestamp);

                CREATE TABLE IF NOT EXISTS system_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    category VARCHAR(50) NOT NULL,
                    message TEXT NOT NULL,
                    details JSONB,
                    status VARCHAR(50) NOT NULL,
                    timestamp BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
            `);

            // Migrations - run separately to ensure they execute even if tables already exist
            try {
                await client.query(`
                    DO $$
                    BEGIN
                        -- Sessions Migrations
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='created_at') THEN
                            ALTER TABLE sessions ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0;
                        END IF;

                        -- Proxies Migrations
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='name') THEN
                            ALTER TABLE proxies ADD COLUMN name VARCHAR(255) DEFAULT '';
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='type') THEN
                            ALTER TABLE proxies ADD COLUMN type VARCHAR(50) DEFAULT '';
                        END IF;
                         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='server') THEN
                            ALTER TABLE proxies ADD COLUMN server VARCHAR(255);
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='port') THEN
                            ALTER TABLE proxies ADD COLUMN port INTEGER;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='config') THEN
                            ALTER TABLE proxies ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxies' AND column_name='created_at') THEN
                            ALTER TABLE proxies ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0;
                        END IF;

                        -- Proxy Groups Migrations
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='name') THEN
                            ALTER TABLE proxy_groups ADD COLUMN name VARCHAR(255) DEFAULT '';
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='type') THEN
                            ALTER TABLE proxy_groups ADD COLUMN type VARCHAR(50) DEFAULT '';
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='proxies') THEN
                            ALTER TABLE proxy_groups ADD COLUMN proxies JSONB DEFAULT '[]'::jsonb;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='config') THEN
                            ALTER TABLE proxy_groups ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='priority') THEN
                            ALTER TABLE proxy_groups ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proxy_groups' AND column_name='created_at') THEN
                            ALTER TABLE proxy_groups ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0;
                        END IF;

                        -- Rules Migrations
                         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rules' AND column_name='rule_text') THEN
                            ALTER TABLE rules ADD COLUMN rule_text JSONB DEFAULT '[]'::jsonb;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rules' AND column_name='priority') THEN
                            ALTER TABLE rules ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rules' AND column_name='created_at') THEN
                            ALTER TABLE rules ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0;
                        END IF;
                    END $$;
                `);
            } catch (e) {
                console.warn('Migration failed (non-critical):', e);
            }

        } finally {
            client.release();
        }
    }

    // User operations
    async getUser(username: string): Promise<User | null> {
        await this.ensureInitialized();
        const result = await this.pool.query(
            'SELECT password, role, status, created_at FROM users WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            password: row.password,
            role: row.role,
            status: row.status,
            createdAt: parseInt(row.created_at),
        };
    }

    async setUser(username: string, data: User): Promise<void> {
        await this.pool.query(
            `INSERT INTO users (username, password, role, status, created_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO UPDATE SET
                 password = EXCLUDED.password,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status`,
            [username, data.password, data.role, data.status, data.createdAt]
        );
    }

    async deleteUser(username: string): Promise<void> {
        await this.pool.query('DELETE FROM users WHERE username = $1', [username]);
    }

    async getAllUsers(): Promise<Array<User & { username: string }>> {
        await this.ensureInitialized();
        const result = await this.pool.query('SELECT * FROM users');
        return result.rows.map((row) => ({
            username: row.username,
            password: row.password,
            role: row.role,
            status: row.status,
            createdAt: parseInt(row.created_at),
        }));
    }

    async userExists(username: string): Promise<boolean> {
        const result = await this.pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
        return result.rows.length > 0;
    }

    // Session operations
    async createSession(sessionId: string, data: Session, ttl: number): Promise<void> {
        await this.ensureInitialized();
        const expiresAt = Date.now() + ttl * 1000;
        const createdAt = Date.now();
        await this.pool.query(
            `INSERT INTO sessions (session_id, username, role, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (session_id) DO UPDATE SET
                 username = EXCLUDED.username,
                 role = EXCLUDED.role,
                 created_at = EXCLUDED.created_at,
                 expires_at = EXCLUDED.expires_at`,
            [sessionId, data.username, data.role, createdAt, expiresAt]
        );
    }

    async getSession(sessionId: string): Promise<Session | null> {
        await this.ensureInitialized();

        try {
            // Clean up expired sessions
            await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);

            const result = await this.pool.query(
                'SELECT username, role FROM sessions WHERE session_id = $1 AND expires_at > $2',
                [sessionId, Date.now()]
            );
            if (result.rows.length === 0) return null;
            return {
                username: result.rows[0].username,
                role: result.rows[0].role,
            };
        } catch (error) {
            console.error('Error in getSession:', error);
            // If connection error, try to reinitialize
            if ((error as any).code === 'ECONNRESET' || (error as any).message?.includes('terminated')) {
                console.log('Connection lost, reinitializing...');
                this.initialized = false;
                await this.ensureInitialized();
                // Retry once
                const result = await this.pool.query(
                    'SELECT username, role FROM sessions WHERE session_id = $1 AND expires_at > $2',
                    [sessionId, Date.now()]
                );
                if (result.rows.length === 0) return null;
                return {
                    username: result.rows[0].username,
                    role: result.rows[0].role,
                };
            }
            throw error;
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
    }

    // Subscription operations
    async createSubscription(token: string, username: string, data: SubData): Promise<void> {
        await this.pool.query(
            `INSERT INTO subscriptions (token, username, remark, group_id, rule_id, custom_rules, selected_sources, enabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                token,
                username,
                data.remark,
                data.groupId,
                data.ruleId,
                data.customRules,
                JSON.stringify(data.selectedSources || []),
                data.enabled,
                data.createdAt
            ]
        );
    }

    async getSubscription(token: string): Promise<(SubData & { token: string }) | null> {
        const result = await this.pool.query('SELECT * FROM subscriptions WHERE token = $1', [token]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: row.selected_sources || [],
            enabled: row.enabled,
            createdAt: parseInt(row.created_at),
        };
    }

    async getAllSubscriptions(): Promise<Array<SubData & { token: string }>> {
        await this.ensureInitialized();
        const result = await this.pool.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
        return result.rows.map((row) => ({
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: row.selected_sources || [],
            enabled: row.enabled,
            createdAt: parseInt(row.created_at),
        }));
    }

    async deleteSubscription(token: string, username: string): Promise<void> {
        await this.pool.query('DELETE FROM subscriptions WHERE token = $1', [token]);
    }

    async updateSubscription(token: string, data: SubData): Promise<void> {
        await this.pool.query(
            `UPDATE subscriptions SET
                 remark = $2,
                 group_id = $3,
                 rule_id = $4,
                 custom_rules = $5,
                 selected_sources = $6,
                 enabled = $7
             WHERE token = $1`,
            [
                token,
                data.remark,
                data.groupId,
                data.ruleId,
                data.customRules,
                JSON.stringify(data.selectedSources || []),
                data.enabled
            ]
        );
    }

    async getUserSubscriptions(username: string): Promise<Array<SubData & { token: string }>> {
        const result = await this.pool.query('SELECT * FROM subscriptions WHERE username = $1', [username]);
        return result.rows.map((row) => ({
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: row.selected_sources || [],
            enabled: row.enabled,
            createdAt: parseInt(row.created_at),
        }));
    }

    async isSubscriptionOwner(username: string, token: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM subscriptions WHERE token = $1 AND username = $2',
            [token, username]
        );
        return result.rows.length > 0;
    }

    // Config operations
    async getGlobalConfig(): Promise<GlobalConfig> {
        await this.ensureInitialized();
        const result = await this.pool.query('SELECT value FROM global_config WHERE key = $1', ['global']);
        if (result.rows.length === 0) return {};
        return JSON.parse(result.rows[0].value);
    }

    async setGlobalConfig(data: GlobalConfig): Promise<void> {
        await this.pool.query(
            `INSERT INTO global_config (key, value, updated_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_at = EXCLUDED.updated_at`,
            ['global', JSON.stringify(data), Date.now()]
        );
    }

    async getCustomGroups(): Promise<ConfigSet[]> {
        const result = await this.pool.query('SELECT * FROM custom_groups');
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
        }));
    }

    async getCustomGroup(id: string): Promise<ConfigSet | null> {
        const result = await this.pool.query('SELECT * FROM custom_groups WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
        };
    }

    async saveCustomGroup(id: string | null, name: string, content: string): Promise<void> {
        const newId = id || nanoid(8);
        await this.pool.query(
            `INSERT INTO custom_groups (id, name, content, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 content = EXCLUDED.content,
                 updated_at = EXCLUDED.updated_at`,
            [newId, name, content, Date.now()]
        );
    }

    async deleteCustomGroup(id: string): Promise<void> {
        await this.pool.query('DELETE FROM custom_groups WHERE id = $1', [id]);
    }


    async getCustomRules(): Promise<ConfigSet[]> {
        const result = await this.pool.query('SELECT * FROM custom_rules');
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
        }));
    }

    async getCustomRule(id: string): Promise<ConfigSet | null> {
        const result = await this.pool.query('SELECT * FROM custom_rules WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
        };
    }

    async saveCustomRule(id: string | null, name: string, content: string): Promise<void> {
        const newId = id || nanoid(8);
        await this.pool.query(
            `INSERT INTO custom_rules (id, name, content, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 content = EXCLUDED.content,
                 updated_at = EXCLUDED.updated_at`,
            [newId, name, content, Date.now()]
        );
    }

    async deleteCustomRule(id: string): Promise<void> {
        await this.pool.query('DELETE FROM custom_rules WHERE id = $1', [id]);
    }

    // Cache operations
    async getCache(key: string): Promise<string | null> {
        // No expiration check needed as per new infinite cache strategy
        const result = await this.pool.query(
            'SELECT value FROM cache WHERE key = $1',
            [key]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0].value;
    }

    async setCache(key: string, value: string, ttl?: number): Promise<void> {
        // expires_at column is reused to store 'created_at' timestamp since we removed expiration logic.
        const expiresAt = Date.now();
        await this.pool.query(
            `INSERT INTO cache (key, value, expires_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value,
                 expires_at = EXCLUDED.expires_at`,
            [key, value, expiresAt]
        );
    }

    async deleteCache(key: string): Promise<void> {
        await this.pool.query('DELETE FROM cache WHERE key = $1', [key]);
    }

    async clearAllSubscriptionCaches(): Promise<void> {
        await this.pool.query("DELETE FROM cache WHERE key LIKE 'cache:subscription:%'");
    }

    // Structured upstream data operations
    // Proxies
    async saveProxies(proxies: Proxy[]): Promise<void> {
        if (proxies.length === 0) return;

        for (const proxy of proxies) {
            await this.pool.query(
                `INSERT INTO proxies (id, name, type, server, port, config, source, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                     name = EXCLUDED.name,
                     type = EXCLUDED.type,
                     server = EXCLUDED.server,
                     port = EXCLUDED.port,
                     config = EXCLUDED.config,
                     source = EXCLUDED.source`,
                [proxy.id, proxy.name, proxy.type, proxy.server, proxy.port, JSON.stringify(proxy.config), proxy.source, proxy.createdAt]
            );
        }
    }

    async getProxies(source?: string): Promise<Proxy[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM proxies';
        const params: any[] = [];

        if (source) {
            query += ' WHERE source = $1';
            params.push(source);
        }

        const result = await this.pool.query(query, params);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            server: row.server,
            port: row.port,
            config: row.config, // PostgreSQL JSONB is already parsed
            source: row.source,
            createdAt: parseInt(row.created_at),
        }));
    }

    async clearProxies(source: string): Promise<void> {
        await this.pool.query('DELETE FROM proxies WHERE source = $1', [source]);
    }

    // Proxy Groups
    async saveProxyGroups(groups: ProxyGroup[]): Promise<void> {
        if (groups.length === 0) return;

        for (const group of groups) {
            await this.pool.query(
                `INSERT INTO proxy_groups (id, name, type, proxies, config, source, priority, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                     name = EXCLUDED.name,
                     type = EXCLUDED.type,
                     proxies = EXCLUDED.proxies,
                     config = EXCLUDED.config,
                     source = EXCLUDED.source,
                     priority = EXCLUDED.priority`,
                [group.id, group.name, group.type, JSON.stringify(group.proxies), JSON.stringify(group.config), group.source, group.priority, group.createdAt]
            );
        }
    }

    async getProxyGroups(source?: string): Promise<ProxyGroup[]> {
        let query = 'SELECT * FROM proxy_groups';
        const params: any[] = [];

        if (source) {
            query += ' WHERE source = $1';
            params.push(source);
        }

        query += ' ORDER BY priority ASC, created_at ASC';

        const result = await this.pool.query(query, params);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            proxies: row.proxies, // PostgreSQL JSONB is already parsed
            config: row.config,   // PostgreSQL JSONB is already parsed
            source: row.source,
            priority: row.priority,
            createdAt: parseInt(row.created_at),
        }));
    }

    async clearProxyGroups(source: string): Promise<void> {
        await this.pool.query('DELETE FROM proxy_groups WHERE source = $1', [source]);
    }

    // Rules - Store as single JSON array for performance
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
        for (const [source, sourceRules] of Object.entries(rulesBySource)) {
            const rulesJson = JSON.stringify(sourceRules.map(r => r.ruleText));
            await this.pool.query(
                `INSERT INTO rules (id, rule_text, priority, source, created_at, data)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                     rule_text = EXCLUDED.rule_text,
                     priority = EXCLUDED.priority,
                     data = EXCLUDED.data`,
                [source, rulesJson, 0, source, Date.now(), rulesJson]
            );
        }
    }

    async getRules(source?: string): Promise<Rule[]> {
        let query = 'SELECT * FROM rules';
        const params: any[] = [];

        if (source) {
            query += ' WHERE id = $1';
            params.push(source);
        }

        const result = await this.pool.query(query, params);

        const allRules: Rule[] = [];
        for (const row of result.rows) {
            const ruleTexts = row.rule_text as string[]; // PostgreSQL JSONB is already parsed
            allRules.push(...ruleTexts.map((text, index) => ({
                id: `${row.id}_${index}`,
                ruleText: text,
                priority: index,
                source: row.source,
                createdAt: parseInt(row.created_at),
            })));
        }

        return allRules.sort((a, b) => a.priority - b.priority);
    }

    async clearRules(source: string): Promise<void> {
        await this.pool.query('DELETE FROM rules WHERE source = $1', [source]);
    }

    // Upstream Config
    async saveUpstreamConfigItem(key: string, value: any): Promise<void> {
        await this.pool.query(
            `INSERT INTO upstream_config (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value`,
            [key, JSON.stringify(value)]
        );
    }

    async getUpstreamConfigItem(key: string): Promise<any> {
        const result = await this.pool.query('SELECT value FROM upstream_config WHERE key = $1', [key]);
        if (result.rows.length === 0) return null;
        return result.rows[0].value; // PostgreSQL JSONB is already parsed
    }

    async getAllUpstreamConfig(): Promise<Record<string, any>> {
        const result = await this.pool.query('SELECT key, value FROM upstream_config');
        const config: Record<string, any> = {};
        for (const row of result.rows) {
            config[row.key] = row.value; // PostgreSQL JSONB is already parsed
        }
        return config;
    }

    // Logs
    async createAPIAccessLog(log: Omit<import('./interface').APIAccessLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pool.query(
            `INSERT INTO api_access_logs (id, token, username, ip, ua, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, log.token, log.username, log.ip, log.ua, log.status, log.timestamp]
        );
    }

    async getAPIAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').APIAccessLog[]> {
        let query = 'SELECT * FROM api_access_logs';
        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
            query += ` WHERE token ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR ip ILIKE $${paramIndex} OR ua ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            token: row.token,
            username: row.username,
            ip: row.ip,
            ua: row.ua,
            status: row.status,
            timestamp: parseInt(row.timestamp)
        }));
    }

    async createWebAccessLog(log: Omit<import('./interface').WebAccessLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pool.query(
            `INSERT INTO web_access_logs (id, path, ip, ua, username, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, log.path, log.ip, log.ua, log.username, log.status, log.timestamp]
        );
    }

    async getWebAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').WebAccessLog[]> {
        let query = 'SELECT * FROM web_access_logs';
        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
            query += ` WHERE path ILIKE $${paramIndex} OR ip ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR ua ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            path: row.path,
            ip: row.ip,
            ua: row.ua,
            username: row.username,
            status: row.status,
            timestamp: parseInt(row.timestamp)
        }));
    }

    async createSystemLog(log: Omit<import('./interface').SystemLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pool.query(
            `INSERT INTO system_logs (id, category, message, details, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, log.category, log.message, JSON.stringify(log.details), log.status, log.timestamp]
        );
    }

    async getSystemLogs(limit: number, offset: number, search?: string): Promise<import('./interface').SystemLog[]> {
        let query = 'SELECT * FROM system_logs';
        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
            query += ` WHERE message ILIKE $${paramIndex} OR category ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            category: row.category,
            message: row.message,
            details: row.details,
            status: row.status,
            timestamp: parseInt(row.timestamp)
        }));
    }

    async cleanupLogs(retentionDays: number): Promise<void> {
        if (!retentionDays || retentionDays <= 0) return;
        const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        await this.pool.query('DELETE FROM api_access_logs WHERE timestamp < $1', [cutoff]);
        await this.pool.query('DELETE FROM web_access_logs WHERE timestamp < $1', [cutoff]);
        await this.pool.query('DELETE FROM system_logs WHERE timestamp < $1', [cutoff]);
    }

    async deleteAllLogs(): Promise<void> {
        await this.pool.query('DELETE FROM api_access_logs');
        await this.pool.query('DELETE FROM web_access_logs');
        await this.pool.query('DELETE FROM system_logs');
    }
}
