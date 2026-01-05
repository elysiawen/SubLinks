import { Pool, PoolClient } from 'pg';
import { IDatabase, User, Session, SubData, ConfigSet, GlobalConfig, Proxy, ProxyGroup, Rule, PaginatedResult } from './interface';
import { nanoid } from 'nanoid';

export default class PostgresDatabase implements IDatabase {
    private pool: Pool;
    private initialized: boolean = false;
    private cleanupTimer?: NodeJS.Timeout;

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

        // No background timer in serverless.
        // Session cleanup is handled lazily in getSession, or use a Cron Job.
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
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    max_subscriptions INTEGER, -- null = follow global, number = custom limit
                    created_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

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
                    user_id VARCHAR(255),
                    name VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    is_global BOOLEAN DEFAULT FALSE,
                    updated_at BIGINT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS custom_rules (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    name VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    is_global BOOLEAN DEFAULT FALSE,
                    updated_at BIGINT NOT NULL
                );
                
                -- Migration: Add user_id and is_global columns if they don't exist
                DO $$
                BEGIN
                    -- Add user_id to custom_groups if not exists
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='custom_groups' AND column_name='user_id') THEN
                        ALTER TABLE custom_groups ADD COLUMN user_id VARCHAR(255);
                    END IF;
                    
                    -- Add is_global to custom_groups if not exists
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='custom_groups' AND column_name='is_global') THEN
                        ALTER TABLE custom_groups ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
                    END IF;
                    
                    -- Add user_id to custom_rules if not exists
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='custom_rules' AND column_name='user_id') THEN
                        ALTER TABLE custom_rules ADD COLUMN user_id VARCHAR(255);
                    END IF;
                    
                    -- Add is_global to custom_rules if not exists
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='custom_rules' AND column_name='is_global') THEN
                        ALTER TABLE custom_rules ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
                    END IF;
                    
                    -- Migrate existing data: assign to admin user
                    UPDATE custom_groups SET user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) 
                    WHERE user_id IS NULL;
                    
                    UPDATE custom_rules SET user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) 
                    WHERE user_id IS NULL;
                END $$;

                CREATE TABLE IF NOT EXISTS api_access_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    token VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    ip VARCHAR(255) NOT NULL,
                    ua TEXT NOT NULL,
                    status INTEGER NOT NULL,
                    timestamp BIGINT NOT NULL,
                    api_type VARCHAR(255),
                    request_method VARCHAR(255)
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

                CREATE TABLE IF NOT EXISTS upstream_sources (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    url TEXT NOT NULL,
                    cache_duration NUMERIC DEFAULT 24,
                    ua_whitelist JSONB DEFAULT '[]'::jsonb,
                    is_default BOOLEAN DEFAULT false,
                    last_updated BIGINT DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    error TEXT,
                    traffic JSONB,
                    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
                    updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
                );
                CREATE INDEX IF NOT EXISTS idx_upstream_sources_name ON upstream_sources(name);
                CREATE INDEX IF NOT EXISTS idx_upstream_sources_is_default ON upstream_sources(is_default);
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

                        -- User UUID Migration
                        -- Add id column if it doesn't exist
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN
                            ALTER TABLE users ADD COLUMN id UUID DEFAULT gen_random_uuid();
                            -- Generate UUIDs for existing users
                            UPDATE users SET id = gen_random_uuid() WHERE id IS NULL;
                            -- Make id NOT NULL and PRIMARY KEY
                            ALTER TABLE users ALTER COLUMN id SET NOT NULL;
                            -- Drop old primary key constraint on username
                            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
                            -- Add new primary key on id
                            ALTER TABLE users ADD PRIMARY KEY (id);
                            -- Make username unique
                            ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
                        END IF;

                        -- Sessions: Add user_id column
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='user_id') THEN
                            ALTER TABLE sessions ADD COLUMN user_id UUID;
                            -- Populate user_id from username
                            UPDATE sessions s SET user_id = u.id FROM users u WHERE s.username = u.username;
                        END IF;

                        -- Subscriptions: Add user_id column
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='user_id') THEN
                            ALTER TABLE subscriptions ADD COLUMN user_id UUID;
                            -- Populate user_id from username
                            UPDATE subscriptions s SET user_id = u.id FROM users u WHERE s.username = u.username;
                        END IF;

                        -- Users: Add max_subscriptions column
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_subscriptions') THEN
                            ALTER TABLE users ADD COLUMN max_subscriptions INTEGER;
                            -- Default is NULL (follow global settings)
                        END IF;

                        -- GlobalConfig Migration: Single JSON row -> Multi-row Key-Value
                        IF EXISTS (SELECT 1 FROM global_config WHERE key = 'global') THEN
                            RAISE NOTICE '🔄 Migrating global_config from single JSON row to multi-row Key-Value...';
                            
                            DECLARE
                                old_row RECORD;
                                config_json JSONB;
                            BEGIN
                                -- Get the old global row
                                SELECT * INTO old_row FROM global_config WHERE key = 'global';
                                
                                IF FOUND THEN
                                    config_json := old_row.value::jsonb;
                                    
                                    -- Delete the old row
                                    DELETE FROM global_config WHERE key = 'global';
                                    
                                    -- Insert individual keys
                                    -- maxUserSubscriptions
                                    IF config_json->>'maxUserSubscriptions' IS NOT NULL THEN
                                        INSERT INTO global_config (key, value, updated_at)
                                        VALUES ('maxUserSubscriptions', config_json->>'maxUserSubscriptions', old_row.updated_at);
                                    END IF;
                                    
                                    -- logRetentionDays
                                    IF config_json->>'logRetentionDays' IS NOT NULL THEN
                                        INSERT INTO global_config (key, value, updated_at)
                                        VALUES ('logRetentionDays', config_json->>'logRetentionDays', old_row.updated_at);
                                    END IF;
                                    
                                    -- uaWhitelist (stored as JSON string)
                                    IF config_json->'uaWhitelist' IS NOT NULL THEN
                                        INSERT INTO global_config (key, value, updated_at)
                                        VALUES ('uaWhitelist', (config_json->'uaWhitelist')::text, old_row.updated_at);
                                    END IF;
                                    
                                    -- refreshApiKey
                                    IF config_json->>'refreshApiKey' IS NOT NULL THEN
                                        INSERT INTO global_config (key, value, updated_at)
                                        VALUES ('refreshApiKey', config_json->>'refreshApiKey', old_row.updated_at);
                                    END IF;
                                    
                                    -- upstreamLastUpdated
                                    IF config_json->>'upstreamLastUpdated' IS NOT NULL THEN
                                        INSERT INTO global_config (key, value, updated_at)
                                        VALUES ('upstreamLastUpdated', config_json->>'upstreamLastUpdated', old_row.updated_at);
                                    END IF;
                                    
                                    RAISE NOTICE '✅ Migration to multi-row completed!';
                                END IF;
                            END;
                        END IF;


                        -- Upstream Sources: Add traffic column
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upstream_sources' AND column_name='traffic') THEN
                            ALTER TABLE upstream_sources ADD COLUMN traffic JSONB;
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
            'SELECT id, username, password, role, status, max_subscriptions, created_at FROM users WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            password: row.password,
            role: row.role,
            status: row.status,
            maxSubscriptions: row.max_subscriptions,
            createdAt: parseInt(row.created_at),
        };
    }

    async getUserById(id: string): Promise<User | null> {
        await this.ensureInitialized();
        const result = await this.pool.query(
            'SELECT id, username, password, role, status, max_subscriptions, created_at FROM users WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            password: row.password,
            role: row.role,
            status: row.status,
            maxSubscriptions: row.max_subscriptions,
            createdAt: parseInt(row.created_at),
        };
    }

    async setUser(username: string, data: User): Promise<void> {
        await this.pool.query(
            `INSERT INTO users (username, password, role, status, max_subscriptions, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (username) DO UPDATE SET
                 password = EXCLUDED.password,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status,
                 max_subscriptions = EXCLUDED.max_subscriptions
             RETURNING id`,
            [username, data.password, data.role, data.status, data.maxSubscriptions, data.createdAt]
        );
    }

    async deleteUser(username: string): Promise<void> {
        await this.pool.query('DELETE FROM users WHERE username = $1', [username]);
    }

    async getAllUsers(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResult<User & { username: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM users';
        let countQuery = 'SELECT COUNT(*) FROM users';
        const params: any[] = [];
        const countParams: any[] = [];

        if (search) {
            query += ' WHERE username ILIKE $1';
            countQuery += ' WHERE username ILIKE $1';
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        const data = result.rows.map((row) => ({
            id: row.id,
            username: row.username,
            password: row.password,
            role: row.role,
            status: row.status,
            maxSubscriptions: row.max_subscriptions,
            createdAt: parseInt(row.created_at),
        }));

        return { data, total };
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
            `INSERT INTO sessions (session_id, user_id, username, role, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (session_id) DO UPDATE SET
                 user_id = EXCLUDED.user_id,
                 username = EXCLUDED.username,
                 role = EXCLUDED.role,
                 created_at = EXCLUDED.created_at,
                 expires_at = EXCLUDED.expires_at`,
            [sessionId, data.userId, data.username, data.role, createdAt, expiresAt]
        );
    }

    async getSession(sessionId: string): Promise<Session | null> {
        await this.ensureInitialized();

        try {
            // Clean up expired sessions
            await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);

            const result = await this.pool.query(
                'SELECT user_id, username, role FROM sessions WHERE session_id = $1 AND expires_at > $2',
                [sessionId, Date.now()]
            );
            if (result.rows.length === 0) return null;
            return {
                userId: result.rows[0].user_id,
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
                    'SELECT user_id, username, role FROM sessions WHERE session_id = $1 AND expires_at > $2',
                    [sessionId, Date.now()]
                );
                if (result.rows.length === 0) return null;
                return {
                    userId: result.rows[0].user_id,
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

    async cleanupExpiredSessions(): Promise<number> {
        const result = await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
        return result.rowCount || 0;
    }

    // Subscription operations
    async createSubscription(token: string, username: string, data: SubData): Promise<void> {
        // Get user_id from username
        const user = await this.getUser(username);
        const userId = user?.id || null;

        await this.pool.query(
            `INSERT INTO subscriptions (token, username, user_id, remark, group_id, rule_id, custom_rules, selected_sources, enabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                token,
                username,
                userId,
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

    async getAllSubscriptions(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResult<SubData & { token: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM subscriptions';
        let countQuery = 'SELECT COUNT(*) FROM subscriptions';
        const params: any[] = [];
        const countParams: any[] = [];

        if (search) {
            const searchClause = ' WHERE username ILIKE $1 OR remark ILIKE $1 OR token ILIKE $1';
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        const data = result.rows.map((row) => ({
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

        return { data, total };
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
        const result = await this.pool.query('SELECT key, value, updated_at FROM global_config');

        // Default config
        const config: GlobalConfig = {
            maxUserSubscriptions: 10,
            logRetentionDays: 30
        };

        let maxUpdatedAt = 0;

        for (const row of result.rows) {
            const updatedAt = parseInt(row.updated_at);
            if (updatedAt > maxUpdatedAt) maxUpdatedAt = updatedAt;

            switch (row.key) {
                case 'maxUserSubscriptions':
                    config.maxUserSubscriptions = parseInt(row.value);
                    break;
                case 'logRetentionDays':
                    config.logRetentionDays = parseInt(row.value);
                    break;
                case 'uaWhitelist':
                    try {
                        config.uaWhitelist = JSON.parse(row.value);
                    } catch (e) {
                        console.warn('Failed to parse uaWhitelist:', e);
                        config.uaWhitelist = [];
                    }
                    break;
                case 'refreshApiKey':
                    config.refreshApiKey = row.value;
                    break;
                case 'upstreamLastUpdated':
                    config.upstreamLastUpdated = parseInt(row.value);
                    break;
                case 'upstreamUserAgent':
                    config.upstreamUserAgent = row.value;
                    break;
                case 'customBackgroundUrl':
                    config.customBackgroundUrl = row.value;
                    break;
            }
        }

        config.updatedAt = maxUpdatedAt > 0 ? maxUpdatedAt : undefined;
        return config;
    }

    async setGlobalConfig(data: GlobalConfig): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const now = Date.now();
            const updates: [string, string][] = [
                ['maxUserSubscriptions', data.maxUserSubscriptions.toString()],
                ['logRetentionDays', data.logRetentionDays.toString()]
            ];

            if (data.uaWhitelist !== undefined) {
                updates.push(['uaWhitelist', JSON.stringify(data.uaWhitelist)]);
            }

            if (data.refreshApiKey !== undefined) {
                updates.push(['refreshApiKey', data.refreshApiKey]);
            }

            if (data.upstreamLastUpdated !== undefined) {
                updates.push(['upstreamLastUpdated', data.upstreamLastUpdated.toString()]);
            }

            if (data.upstreamUserAgent !== undefined) {
                updates.push(['upstreamUserAgent', data.upstreamUserAgent]);
            }

            if (data.customBackgroundUrl !== undefined) {
                updates.push(['customBackgroundUrl', data.customBackgroundUrl]);
            }

            for (const [key, value] of updates) {
                await client.query(
                    `INSERT INTO global_config (key, value, updated_at)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (key) DO UPDATE SET
                         value = EXCLUDED.value,
                         updated_at = CASE 
                             WHEN global_config.value != EXCLUDED.value THEN EXCLUDED.updated_at 
                             ELSE global_config.updated_at 
                         END`,
                    [key, value, now]
                );
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    // User-scoped: returns user's own + global configs
    async getCustomGroups(userId: string): Promise<ConfigSet[]> {
        const result = await this.pool.query(
            'SELECT * FROM custom_groups WHERE user_id = $1 OR is_global = TRUE',
            [userId]
        );
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false
        }));
    }

    async getCustomGroup(id: string, userId: string): Promise<ConfigSet | null> {
        const result = await this.pool.query(
            'SELECT * FROM custom_groups WHERE id = $1 AND (user_id = $2 OR is_global = TRUE)',
            [id, userId]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false
        };
    }

    async saveCustomGroup(id: string | null, userId: string, name: string, content: string, isGlobal: boolean = false): Promise<void> {
        const newId = id || nanoid(8);
        await this.pool.query(
            `INSERT INTO custom_groups (id, user_id, name, content, is_global, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 content = EXCLUDED.content,
                 is_global = EXCLUDED.is_global,
                 updated_at = EXCLUDED.updated_at`,
            [newId, userId, name, content, isGlobal, Date.now()]
        );
    }

    async deleteCustomGroup(id: string, userId: string): Promise<void> {
        // Only allow deleting own configs
        await this.pool.query(
            'DELETE FROM custom_groups WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
    }

    // Admin method: returns all configs with username
    async getAllCustomGroups(): Promise<ConfigSet[]> {
        const result = await this.pool.query(`
            SELECT cg.*, u.username 
            FROM custom_groups cg
            LEFT JOIN users u ON cg.user_id::uuid = u.id
        `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false,
            username: row.username || '未知用户'
        }));
    }


    // User-scoped: returns user's own + global configs
    async getCustomRules(userId: string): Promise<ConfigSet[]> {
        const result = await this.pool.query(
            'SELECT * FROM custom_rules WHERE user_id = $1 OR is_global = TRUE',
            [userId]
        );
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false
        }));
    }

    async getCustomRule(id: string, userId: string): Promise<ConfigSet | null> {
        const result = await this.pool.query(
            'SELECT * FROM custom_rules WHERE id = $1 AND (user_id = $2 OR is_global = TRUE)',
            [id, userId]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false
        };
    }

    async saveCustomRule(id: string | null, userId: string, name: string, content: string, isGlobal: boolean = false): Promise<void> {
        const newId = id || nanoid(8);
        await this.pool.query(
            `INSERT INTO custom_rules (id, user_id, name, content, is_global, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 content = EXCLUDED.content,
                 is_global = EXCLUDED.is_global,
                 updated_at = EXCLUDED.updated_at`,
            [newId, userId, name, content, isGlobal, Date.now()]
        );
    }

    async deleteCustomRule(id: string, userId: string): Promise<void> {
        // Only allow deleting own configs
        await this.pool.query(
            'DELETE FROM custom_rules WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
    }

    // Admin method: returns all configs with username
    async getAllCustomRules(): Promise<ConfigSet[]> {
        const result = await this.pool.query(`
            SELECT cr.*, u.username 
            FROM custom_rules cr
            LEFT JOIN users u ON cr.user_id::uuid = u.id
        `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: parseInt(row.updated_at),
            userId: row.user_id,
            isGlobal: row.is_global || false,
            username: row.username || '未知用户'
        }));
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
            `INSERT INTO api_access_logs (id, token, username, ip, ua, status, timestamp, api_type, request_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, log.token, log.username, log.ip, log.ua, log.status, log.timestamp, log.apiType || null, log.requestMethod || null]
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
            timestamp: parseInt(row.timestamp),
            apiType: row.api_type || undefined,
            requestMethod: row.request_method || undefined
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

    // Upstream source operations
    async getUpstreamSources(): Promise<import('./interface').UpstreamSource[]> {
        const result = await this.pool.query(
            'SELECT * FROM upstream_sources ORDER BY created_at ASC'
        );
        return result.rows.map(row => ({
            name: row.name,
            url: row.url,
            cacheDuration: row.cache_duration,
            uaWhitelist: row.ua_whitelist,
            isDefault: row.is_default,
            lastUpdated: parseInt(row.last_updated),
            status: row.status as 'pending' | 'success' | 'failure',
            error: row.error,
            traffic: row.traffic
        }));
    }

    async getUpstreamSource(name: string): Promise<import('./interface').UpstreamSource | null> {
        const result = await this.pool.query(
            'SELECT * FROM upstream_sources WHERE name = $1',
            [name]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            name: row.name,
            url: row.url,
            cacheDuration: row.cache_duration,
            uaWhitelist: row.ua_whitelist,
            isDefault: row.is_default,
            lastUpdated: parseInt(row.last_updated),
            status: row.status as 'pending' | 'success' | 'failure',
            error: row.error,
            traffic: row.traffic
        };
    }

    async getUpstreamSourceByName(name: string): Promise<import('./interface').UpstreamSource | null> {
        return this.getUpstreamSource(name); // Alias
    }

    async createUpstreamSource(source: import('./interface').UpstreamSource): Promise<void> {
        const currentTime = Date.now();
        await this.pool.query(`
            INSERT INTO upstream_sources (
                name, url, cache_duration, ua_whitelist, is_default,
                last_updated, status, error, traffic, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            source.name,
            source.url,
            source.cacheDuration || 24,
            JSON.stringify(source.uaWhitelist || []),
            source.isDefault || false,
            source.lastUpdated || 0,
            source.status || 'pending',
            source.error || null,
            source.traffic ? JSON.stringify(source.traffic) : null,
            currentTime,
            currentTime
        ]);
    }

    async updateUpstreamSource(name: string, source: Partial<import('./interface').UpstreamSource>): Promise<void> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (source.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(source.name);
        }
        if (source.url !== undefined) {
            updates.push(`url = $${paramIndex++}`);
            values.push(source.url);
        }
        if (source.cacheDuration !== undefined) {
            updates.push(`cache_duration = $${paramIndex++}`);
            values.push(source.cacheDuration);
        }
        if (source.uaWhitelist !== undefined) {
            updates.push(`ua_whitelist = $${paramIndex++}`);
            values.push(JSON.stringify(source.uaWhitelist));
        }
        if (source.isDefault !== undefined) {
            updates.push(`is_default = $${paramIndex++}`);
            values.push(source.isDefault);
        }
        if (source.lastUpdated !== undefined) {
            updates.push(`last_updated = $${paramIndex++}`);
            values.push(source.lastUpdated);
        }
        if (source.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(source.status);
        }
        if (source.error !== undefined) {
            updates.push(`error = $${paramIndex++}`);
            values.push(source.error);
        }
        if (source.traffic !== undefined) {
            updates.push(`traffic = $${paramIndex++}`);
            values.push(source.traffic ? JSON.stringify(source.traffic) : null);
        }

        if (updates.length === 0) return;

        updates.push(`updated_at = $${paramIndex++}`);
        values.push(Date.now());

        values.push(name);
        await this.pool.query(
            `UPDATE upstream_sources SET ${updates.join(', ')} WHERE name = $${paramIndex}`,
            values
        );
    }

    async deleteUpstreamSource(name: string): Promise<void> {
        await this.pool.query('DELETE FROM upstream_sources WHERE name = $1', [name]);
    }

    async setDefaultUpstreamSource(name: string): Promise<void> {
        // First, unset all defaults
        await this.pool.query('UPDATE upstream_sources SET is_default = false');
        // Then set the specified one as default
        await this.pool.query('UPDATE upstream_sources SET is_default = true WHERE name = $1', [name]);
    }
}
