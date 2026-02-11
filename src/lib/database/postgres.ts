import { Pool, PoolClient } from 'pg';
import { IDatabase, User, Session, SubData, ConfigSet, GlobalConfig, Proxy, ProxyGroup, Rule, PaginatedResult, RefreshToken, PasskeyCredentials } from './interface';
import { nanoid } from 'nanoid';
import { getLocation } from '../ip-location';

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

    private initializationPromise: Promise<void> | null = null;

    private async ensureInitialized() {
        if (this.initialized) return;

        if (!this.initializationPromise) {
            this.initializationPromise = this.initTables()
                .then(() => {
                    this.initialized = true;
                })
                .catch((err) => {
                    console.error('Failed to initialize PostgreSQL tables:', err);
                    this.initializationPromise = null; // Allow retry on failure
                });
        }

        await this.initializationPromise;
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
                    max_subscriptions INTEGER,
                    created_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                
                -- Ensure all required columns exist in users
                ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

                CREATE TABLE IF NOT EXISTS subscriptions (
                    token VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    remark VARCHAR(255),
                    group_id VARCHAR(255),
                    rule_id VARCHAR(255),
                    custom_rules TEXT,
                    selected_sources JSONB,
                    selected_sources JSONB,
                    enabled BOOLEAN DEFAULT TRUE,
                    auto_disabled BOOLEAN DEFAULT FALSE,
                    created_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_subscriptions_username ON subscriptions(username);
                
                -- Ensure auto_disabled column exists
                ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_disabled BOOLEAN DEFAULT FALSE;

                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(255) PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    created_at BIGINT NOT NULL DEFAULT 0,
                    expires_at BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
                
                -- Ensure all required columns exist in sessions
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID;
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avatar TEXT;
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip VARCHAR(45);
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ua TEXT;
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active BIGINT DEFAULT 0;
                
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_location VARCHAR(255);
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS isp VARCHAR(255);
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS login_method VARCHAR(50);

                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id UUID NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    token TEXT NOT NULL,
                    ip VARCHAR(45),
                    ua TEXT,
                    device_info VARCHAR(255),
                    created_at BIGINT NOT NULL,
                    expires_at BIGINT NOT NULL,
                    last_active BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
                CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
                CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

                ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_location VARCHAR(255);
                ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS isp VARCHAR(255);

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
                    data JSONB
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
                    data JSONB
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

                -- Add ua_policy and custom_ua_filter columns to upstream_sources if they don't exist
                -- Drop legacy ua_policy and custom_ua_filter columns
                   -- Add enabled column if not exists
                   ALTER TABLE upstream_sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

                CREATE TABLE IF NOT EXISTS passkeys (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id UUID NOT NULL,
                    public_key TEXT NOT NULL,
                    counter BIGINT NOT NULL DEFAULT 0,
                    transports JSONB,
                    name VARCHAR(255),
                    aaguid VARCHAR(36),
                    created_at BIGINT NOT NULL,
                    last_used BIGINT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);
                
                -- Ensure aaguid column exists
                ALTER TABLE passkeys ADD COLUMN IF NOT EXISTS aaguid VARCHAR(36);
            `);

        } finally {
            client.release();
        }
    }

    // User operations
    async getUser(username: string): Promise<User | null> {
        await this.ensureInitialized();
        const result = await this.pool.query(
            'SELECT id, username, password, role, status, max_subscriptions, token_version, nickname, avatar, totp_secret, totp_enabled, created_at FROM users WHERE username = $1',
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
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            totpSecret: row.totp_secret,
            totpEnabled: row.totp_enabled,
            createdAt: parseInt(row.created_at),
        };
    }

    async getUserById(id: string): Promise<User | null> {
        await this.ensureInitialized();
        const result = await this.pool.query(
            'SELECT id, username, password, role, status, max_subscriptions, token_version, nickname, avatar, totp_secret, totp_enabled, created_at FROM users WHERE id = $1',
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
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            totpSecret: row.totp_secret,
            totpEnabled: row.totp_enabled,
            createdAt: parseInt(row.created_at),
        };
    }

    async setUser(username: string, data: User): Promise<void> {
        await this.pool.query(
            `INSERT INTO users (username, password, role, status, max_subscriptions, token_version, nickname, avatar, totp_secret, totp_enabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (username) DO UPDATE SET
                 password = EXCLUDED.password,
                 role = EXCLUDED.role,
                 status = EXCLUDED.status,
                 max_subscriptions = EXCLUDED.max_subscriptions,
                 token_version = EXCLUDED.token_version,
                 nickname = EXCLUDED.nickname,
                 avatar = EXCLUDED.avatar,
                 totp_secret = EXCLUDED.totp_secret,
                 totp_enabled = EXCLUDED.totp_enabled
             RETURNING id`,
            [username, data.password, data.role, data.status, data.maxSubscriptions, data.tokenVersion || 0, data.nickname, data.avatar, data.totpSecret, data.totpEnabled || false, data.createdAt]
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
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            totpEnabled: row.totp_enabled,
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

        let location = data.ipLocation;
        let isp = data.isp;

        if (!location && data.ip) {
            const locInfo = await getLocation(data.ip).catch(() => ({ location: undefined, isp: undefined }));
            location = locInfo.location;
            isp = locInfo.isp;
        }

        await this.pool.query(
            `INSERT INTO sessions (session_id, user_id, username, role, token_version, nickname, avatar, ip, ip_location, isp, ua, device_info, last_active, created_at, expires_at, login_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (session_id) DO UPDATE SET
                 user_id = EXCLUDED.user_id,
                 username = EXCLUDED.username,
                 role = EXCLUDED.role,
                 token_version = EXCLUDED.token_version,
                 nickname = EXCLUDED.nickname,
                 avatar = EXCLUDED.avatar,
                 ip = EXCLUDED.ip,
                 ip_location = EXCLUDED.ip_location,
                 isp = EXCLUDED.isp,
                 ua = EXCLUDED.ua,
                 device_info = EXCLUDED.device_info,
                 last_active = EXCLUDED.last_active,
                 created_at = EXCLUDED.created_at,
                 expires_at = EXCLUDED.expires_at,
                 login_method = EXCLUDED.login_method`,
            [
                sessionId, data.userId, data.username, data.role, data.tokenVersion || 0, data.nickname, data.avatar,
                data.ip, location, isp, data.ua, data.deviceInfo, data.lastActive || createdAt, createdAt, expiresAt, data.loginMethod
            ]
        );
    }

    async getSession(sessionId: string, currentIp?: string): Promise<Session | null> {
        await this.ensureInitialized();

        try {
            // Clean up expired sessions
            await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);

            const result = await this.pool.query(
                'SELECT * FROM sessions WHERE session_id = $1 AND expires_at > $2',
                [sessionId, Date.now()]
            );
            if (result.rows.length === 0) return null;
            const row = result.rows[0];

            // Optimize: Update last active only if more than 60 seconds have passed, or update IP if changed
            const lastActive = Number(row.last_active || 0);
            const storedIp = row.ip;
            const storedLocation = row.ip_location;
            const storedIsp = row.isp;

            if (currentIp && (currentIp !== storedIp || !storedLocation)) {
                let newLocation = storedLocation;
                let newIsp = storedIsp;

                if (currentIp !== storedIp || !storedLocation) {
                    const locInfo = await getLocation(currentIp).catch(() => ({ location: undefined, isp: undefined }));
                    newLocation = locInfo.location;
                    newIsp = locInfo.isp;
                }

                await this.pool.query('UPDATE sessions SET ip = $1, ip_location = $2, isp = $3, last_active = $4, expires_at = $5 WHERE session_id = $6', [currentIp, newLocation, newIsp, Date.now(), Date.now() + 7 * 24 * 60 * 60 * 1000, sessionId]);
                row.ip = currentIp;
                row.ip_location = newLocation;
                row.isp = newIsp;
            } else if (Date.now() - lastActive > 60 * 1000) {
                await this.pool.query('UPDATE sessions SET last_active = $1, expires_at = $2 WHERE session_id = $3', [Date.now(), Date.now() + 7 * 24 * 60 * 60 * 1000, sessionId]);
            }
            return {
                userId: row.user_id,
                username: row.username,
                role: row.role,
                tokenVersion: row.token_version,
                nickname: row.nickname,
                avatar: row.avatar,
                ip: row.ip,
                ipLocation: row.ip_location,
                isp: row.isp,
                ua: row.ua,
                deviceInfo: row.device_info,
                lastActive: parseInt(row.last_active || '0'),
                loginMethod: row.login_method,
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
                const row = result.rows[0];
                return {
                    userId: row.user_id,
                    username: row.username,
                    role: row.role,
                };
            }
            throw error;
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
    }

    async deleteUserSession(userId: string, sessionId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
    }

    async deleteAllUserSessions(userId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }

    async getUserSessions(userId: string): Promise<Session[]> {
        await this.ensureInitialized();
        // Cleanup first
        await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);

        const result = await this.pool.query(
            'SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_active DESC',
            [userId]
        );

        return result.rows.map(row => ({
            sessionId: row.session_id, // This property is extra but harmless at runtime
            userId: row.user_id,
            username: row.username,
            role: row.role,
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            ip: row.ip,
            ipLocation: row.ip_location,
            isp: row.isp,
            ua: row.ua,
            deviceInfo: row.device_info,
            lastActive: Number(row.last_active),
            loginMethod: row.login_method
        }));
    }

    async getAllSessions(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResult<Session & { sessionId: string }>> {
        await this.ensureInitialized();
        await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);

        let query = 'SELECT * FROM sessions';
        let countQuery = 'SELECT COUNT(*) FROM sessions';
        const params: any[] = [];

        if (search) {
            query += ' WHERE (username ILIKE $1 OR ip ILIKE $1 OR ua ILIKE $1 OR nickname ILIKE $1)';
            countQuery += ' WHERE (username ILIKE $1 OR ip ILIKE $1 OR ua ILIKE $1 OR nickname ILIKE $1)';
            params.push(`%${search}%`);
        }

        query += ` ORDER BY last_active DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const [results, countResult] = await Promise.all([
            this.pool.query(query, params),
            this.pool.query(countQuery, search ? [params[0]] : [])
        ]);

        return {
            data: results.rows.map(row => ({
                sessionId: row.session_id,
                userId: row.user_id,
                username: row.username,
                role: row.role,
                tokenVersion: row.token_version,
                nickname: row.nickname,
                avatar: row.avatar,
                ip: row.ip,
                ipLocation: row.ip_location,
                isp: row.isp,
                ua: row.ua,
                deviceInfo: row.device_info,
                lastActive: parseInt(row.last_active || '0'),
                loginMethod: row.login_method
            })),
            total: parseInt(countResult.rows[0].count)
        };
    }

    async getAllRefreshTokens(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResult<RefreshToken>> {
        await this.ensureInitialized();
        await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [Date.now()]);

        let query = 'SELECT * FROM refresh_tokens';
        let countQuery = 'SELECT COUNT(*) FROM refresh_tokens';
        const params: any[] = [];

        if (search) {
            query += ' WHERE (username ILIKE $1 OR ip ILIKE $1 OR ua ILIKE $1 OR device_info ILIKE $1)';
            countQuery += ' WHERE (username ILIKE $1 OR ip ILIKE $1 OR ua ILIKE $1 OR device_info ILIKE $1)';
            params.push(`%${search}%`);
        }

        query += ` ORDER BY last_active DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const [results, countResult] = await Promise.all([
            this.pool.query(query, params),
            this.pool.query(countQuery, search ? [params[0]] : [])
        ]);

        return {
            data: results.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                username: row.username,
                token: row.token,
                ip: row.ip,
                ipLocation: row.ip_location,
                isp: row.isp,
                ua: row.ua,
                deviceInfo: row.device_info,
                createdAt: parseInt(row.created_at),
                expiresAt: parseInt(row.expires_at),
                lastActive: parseInt(row.last_active)
            })),
            total: parseInt(countResult.rows[0].count)
        };
    }

    async cleanupExpiredSessions(): Promise<number> {
        const result = await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
        return result.rowCount || 0;
    }

    // Refresh Token operations
    async createRefreshToken(token: RefreshToken): Promise<void> {
        await this.ensureInitialized();

        let location = token.ipLocation;
        let isp = token.isp;

        if (!location && token.ip) {
            const locInfo = await getLocation(token.ip).catch(() => ({ location: undefined, isp: undefined }));
            location = locInfo.location;
            isp = locInfo.isp;
        }

        await this.pool.query(
            `INSERT INTO refresh_tokens (id, user_id, username, token, ip, ip_location, isp, ua, device_info, created_at, expires_at, last_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                token.id, token.userId, token.username, token.token,
                token.ip, location, isp, token.ua, token.deviceInfo,
                token.createdAt, token.expiresAt, token.lastActive
            ]
        );
    }

    async getRefreshToken(tokenString: string, currentIp?: string, currentUa?: string): Promise<RefreshToken | null> {
        await this.ensureInitialized();
        // Cleanup expired
        await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [Date.now()]);

        const result = await this.pool.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > $2',
            [tokenString, Date.now()]
        );

        if (result.rows.length === 0) return null;
        const row = result.rows[0];

        // Update last active and optionally IP/UA
        const now = Date.now();
        let query = 'UPDATE refresh_tokens SET last_active = $1';
        const params: any[] = [now];
        let idx = 2;

        if (currentIp && currentIp !== row.ip) {
            const locInfo = await getLocation(currentIp).catch(() => ({ location: undefined, isp: undefined }));
            query += `, ip = $${idx++}, ip_location = $${idx++}, isp = $${idx++}`;
            params.push(currentIp, locInfo.location, locInfo.isp);
        }
        if (currentUa && currentUa !== row.ua) {
            query += `, ua = $${idx++}`;
            params.push(currentUa);
        }

        query += ` WHERE id = $${idx++}`;
        params.push(row.id);

        this.pool.query(query, params).catch(console.error);

        return {
            id: row.id,
            userId: row.user_id,
            username: row.username,
            token: row.token,
            ip: row.ip,
            ipLocation: row.ip_location,
            isp: row.isp,
            ua: row.ua,
            deviceInfo: row.device_info,
            createdAt: parseInt(row.created_at),
            expiresAt: parseInt(row.expires_at),
            lastActive: parseInt(row.last_active)
        };
    }

    async deleteRefreshToken(tokenString: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE token = $1', [tokenString]);
    }

    async deleteRefreshTokenById(id: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE id = $1', [id]);
    }

    async deleteUserRefreshToken(userId: string, tokenId: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE id = $1 AND user_id = $2', [tokenId, userId]);
    }

    async deleteAllUserRefreshTokens(userId: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    }

    async getUserRefreshTokens(userId: string): Promise<RefreshToken[]> {
        await this.ensureInitialized();
        // Cleanup expired
        await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [Date.now()]);

        const result = await this.pool.query(
            'SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY last_active DESC',
            [userId]
        );

        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            username: row.username,
            token: row.token,
            ip: row.ip,
            ipLocation: row.ip_location,
            isp: row.isp,
            ua: row.ua,
            deviceInfo: row.device_info,
            createdAt: parseInt(row.created_at),
            expiresAt: parseInt(row.expires_at),
            lastActive: parseInt(row.last_active)
        }));
    }

    async cleanupExpiredRefreshTokens(): Promise<number> {
        const result = await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [Date.now()]);
        return result.rowCount || 0;
    }

    // Subscription operations
    async createSubscription(token: string, username: string, data: SubData): Promise<void> {
        // Get user_id from username
        const user = await this.getUser(username);
        const userId = user?.id || null;

        await this.pool.query(
            `INSERT INTO subscriptions (token, username, user_id, remark, group_id, rule_id, custom_rules, selected_sources, enabled, auto_disabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
                data.autoDisabled || false,
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
            autoDisabled: row.auto_disabled,
            createdAt: parseInt(row.created_at),
        };
    }

    async getAllSubscriptions(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResult<SubData & { token: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT s.*, c.expires_at as cache_time FROM subscriptions s LEFT JOIN cache c ON c.key = \'cache:subscription:\' || s.token';
        let countQuery = 'SELECT COUNT(*) FROM subscriptions s';
        const params: any[] = [];
        const countParams: any[] = [];

        if (search) {
            // Search in username, remark, token, and selected_sources (JSON array as text)
            const searchClause = ' WHERE s.username ILIKE $1 OR s.remark ILIKE $1 OR s.token ILIKE $1 OR s.selected_sources::text ILIKE $1';
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
            autoDisabled: row.auto_disabled,
            createdAt: parseInt(row.created_at),
            cacheTime: row.cache_time ? parseInt(row.cache_time) : undefined,
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
                 enabled = $7,
                 auto_disabled = $8
             WHERE token = $1`,
            [
                token,
                data.remark,
                data.groupId,
                data.ruleId,
                data.customRules,
                JSON.stringify(data.selectedSources || []),
                data.enabled,
                data.autoDisabled || false
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
            autoDisabled: row.auto_disabled,
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

    async getSubscriptionsBySource(sourceName: string): Promise<Array<SubData & { token: string }>> {
        // Check for subscriptions where:
        // 1. selected_sources is NULL
        // 2. selected_sources is empty array '[]'
        // 3. selected_sources contains the sourceName

        // Note: filtered subscriptions store selected_sources as JSONB array ["source1", "source2"]
        const result = await this.pool.query(
            `SELECT * FROM subscriptions WHERE 
             selected_sources IS NULL 
             OR selected_sources = '[]'::jsonb
             OR selected_sources @> $1::jsonb`,
            [JSON.stringify([sourceName])] // @> expects a JSON array on the right side for containment
        );

        return result.rows.map(row => ({
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: row.selected_sources, // Postgres driver parses JSONB automatically
            enabled: row.enabled,
            autoDisabled: row.auto_disabled,
            createdAt: parseInt(row.created_at)
        }));
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

                case 'uaFilter':
                    try {
                        config.uaFilter = JSON.parse(row.value);
                    } catch (e) {
                        console.warn('Failed to parse uaFilter:', e);
                        config.uaFilter = { enabled: false, mode: 'blacklist', rules: [] };
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
                case 'announcement':
                    config.announcement = row.value;
                    break;
                case 'storageProvider':
                    config.storageProvider = row.value as 'local' | 's3';
                    break;
                case 'localStoragePath':
                    config.localStoragePath = row.value;
                    break;

                // Unified S3 configuration
                case 's3Preset':
                    config.s3Preset = row.value as any;
                    break;
                case 's3Endpoint':
                    config.s3Endpoint = row.value;
                    break;
                case 's3Region':
                    config.s3Region = row.value;
                    break;
                case 's3AccessKeyId':
                    config.s3AccessKeyId = row.value;
                    break;
                case 's3SecretAccessKey':
                    config.s3SecretAccessKey = row.value;
                    break;
                case 's3BucketName':
                    config.s3BucketName = row.value;
                    break;
                case 's3PublicDomain':
                    config.s3PublicDomain = row.value;
                    break;
                case 's3FolderPath':
                    config.s3FolderPath = row.value;
                    break;
                case 's3AccountId':
                    config.s3AccountId = row.value;
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



            if (data.uaFilter !== undefined) {
                updates.push(['uaFilter', JSON.stringify(data.uaFilter)]);
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

            if (data.announcement !== undefined) {
                updates.push(['announcement', data.announcement]);
            }

            // Storage configuration
            if (data.storageProvider !== undefined) {
                updates.push(['storageProvider', data.storageProvider]);
            }

            if (data.localStoragePath !== undefined) {
                updates.push(['localStoragePath', data.localStoragePath]);
            }

            // Unified S3 configuration
            if (data.s3Preset !== undefined) {
                updates.push(['s3Preset', data.s3Preset]);
            }

            if (data.s3Endpoint !== undefined) {
                updates.push(['s3Endpoint', data.s3Endpoint]);
            }

            if (data.s3Region !== undefined) {
                updates.push(['s3Region', data.s3Region]);
            }

            if (data.s3AccessKeyId !== undefined) {
                updates.push(['s3AccessKeyId', data.s3AccessKeyId]);
            }

            if (data.s3SecretAccessKey !== undefined) {
                updates.push(['s3SecretAccessKey', data.s3SecretAccessKey]);
            }

            if (data.s3BucketName !== undefined) {
                updates.push(['s3BucketName', data.s3BucketName]);
            }

            if (data.s3PublicDomain !== undefined) {
                updates.push(['s3PublicDomain', data.s3PublicDomain]);
            }

            if (data.s3FolderPath !== undefined) {
                updates.push(['s3FolderPath', data.s3FolderPath]);
            }

            if (data.s3AccountId !== undefined) {
                updates.push(['s3AccountId', data.s3AccountId]);
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

    async clearSubscriptionCache(token: string): Promise<void> {
        await this.pool.query('DELETE FROM cache WHERE key = $1', [`cache:subscription:${token}`]);
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
    async saveUpstreamConfigItem(key: string, value: any, source?: string): Promise<void> {
        const finalKey = source ? `${source}::${key}` : key;
        await this.pool.query(
            `INSERT INTO upstream_config (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET
                 value = EXCLUDED.value`,
            [finalKey, JSON.stringify(value)]
        );
    }

    async getUpstreamConfigItem(key: string): Promise<any> {
        const result = await this.pool.query('SELECT value FROM upstream_config WHERE key = $1', [key]);
        if (result.rows.length === 0) return null;
        return result.rows[0].value;
    }

    async getAllUpstreamConfig(): Promise<Record<string, any>> {
        const result = await this.pool.query('SELECT key, value FROM upstream_config');
        const config: Record<string, any> = {};
        for (const row of result.rows) {
            config[row.key] = row.value;
        }
        return config;
    }

    async getUpstreamConfig(sources?: string[]): Promise<Record<string, any>> {
        const result = await this.pool.query('SELECT key, value FROM upstream_config');

        const sourceConfigs: Record<string, Record<string, any>> = {};
        const globalConfig: Record<string, any> = {};

        for (const row of result.rows) {
            const fullKey = row.key;
            // Check for namespaced keys
            if (fullKey.includes('::')) {
                const parts = fullKey.split('::');
                const src = parts[0];
                const realKey = parts.slice(1).join('::');

                if (!sourceConfigs[src]) sourceConfigs[src] = {};
                sourceConfigs[src][realKey] = row.value;
            } else {
                globalConfig[fullKey] = row.value;
            }
        }

        // Merge logic: Base Global -> + Source 1 -> + Source 2 ...
        // If sources are selected, we do NOT start with globalConfig (to avoid pollution from legacy non-namespaced data)
        const merged = (sources && sources.length > 0) ? {} : { ...globalConfig };

        if (sources && sources.length > 0) {
            for (const src of sources) {
                if (sourceConfigs[src]) {
                    Object.assign(merged, sourceConfigs[src]);
                }
            }
        }

        return merged;
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

    async getAPIAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').PaginatedResult<import('./interface').APIAccessLog>> {
        let query = `
            SELECT 
                l.*,
                u.nickname,
                s.remark as sub_remark
            FROM api_access_logs l
            LEFT JOIN users u ON l.username = u.username
            LEFT JOIN subscriptions s ON l.token = s.token
        `;
        let countQuery = `
            SELECT COUNT(*) 
            FROM api_access_logs l
            LEFT JOIN users u ON l.username = u.username
            LEFT JOIN subscriptions s ON l.token = s.token
        `;

        const params: any[] = [];
        const countParams: any[] = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = ` WHERE l.token ILIKE $${paramIndex} OR l.username ILIKE $${paramIndex} OR l.ip ILIKE $${paramIndex} OR l.ua ILIKE $${paramIndex} OR u.nickname ILIKE $${paramIndex} OR s.remark ILIKE $${paramIndex}`;
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
            paramIndex++;
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY l.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        const data = result.rows.map(row => ({
            id: row.id,
            token: row.token,
            username: row.username,
            nickname: row.nickname || undefined,
            subRemark: row.sub_remark || undefined,
            ip: row.ip,
            ua: row.ua,
            status: row.status,
            timestamp: parseInt(row.timestamp),
            apiType: row.api_type || undefined,
            requestMethod: row.request_method || undefined
        }));

        return { data, total };
    }

    async createWebAccessLog(log: Omit<import('./interface').WebAccessLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pool.query(
            `INSERT INTO web_access_logs (id, path, ip, ua, username, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, log.path, log.ip, log.ua, log.username, log.status, log.timestamp]
        );
    }

    async getWebAccessLogs(limit: number, offset: number, search?: string): Promise<import('./interface').PaginatedResult<import('./interface').WebAccessLog>> {
        let query = `
            SELECT 
                l.*,
                u.nickname
            FROM web_access_logs l
            LEFT JOIN users u ON l.username = u.username
        `;
        let countQuery = `
            SELECT COUNT(*) 
            FROM web_access_logs l
            LEFT JOIN users u ON l.username = u.username
        `;

        const params: any[] = [];
        const countParams: any[] = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = ` WHERE l.path ILIKE $${paramIndex} OR l.ip ILIKE $${paramIndex} OR l.username ILIKE $${paramIndex} OR l.ua ILIKE $${paramIndex} OR u.nickname ILIKE $${paramIndex}`;
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
            paramIndex++;
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY l.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        const data = result.rows.map(row => ({
            id: row.id,
            path: row.path,
            ip: row.ip,
            ua: row.ua,
            username: row.username,
            nickname: row.nickname || undefined,
            status: row.status,
            timestamp: parseInt(row.timestamp)
        }));

        return { data, total };
    }

    async createSystemLog(log: Omit<import('./interface').SystemLog, 'id'>): Promise<void> {
        const id = nanoid();
        await this.pool.query(
            `INSERT INTO system_logs (id, category, message, details, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, log.category, log.message, JSON.stringify(log.details), log.status, log.timestamp]
        );
    }

    async getSystemLogs(limit: number, offset: number, search?: string): Promise<import('./interface').PaginatedResult<import('./interface').SystemLog>> {
        let query = 'SELECT * FROM system_logs';
        let countQuery = 'SELECT COUNT(*) FROM system_logs';

        const params: any[] = [];
        const countParams: any[] = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = ` WHERE message ILIKE $${paramIndex} OR category ILIKE $${paramIndex}`;
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
            paramIndex++;
        }

        const countResult = await this.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        const data = result.rows.map(row => ({
            id: row.id,
            category: row.category,
            message: row.message,
            details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
            status: row.status,
            timestamp: parseInt(row.timestamp)
        }));

        return { data, total };
    }

    async cleanupLogs(retentionDays: number, logTypes: string[] = ['api', 'web', 'system']): Promise<void> {
        if (retentionDays < 0) return;
        const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        const promises = [];
        if (logTypes.includes('api')) {
            promises.push(this.pool.query('DELETE FROM api_access_logs WHERE timestamp < $1', [cutoff]));
        }
        if (logTypes.includes('web')) {
            promises.push(this.pool.query('DELETE FROM web_access_logs WHERE timestamp < $1', [cutoff]));
        }
        if (logTypes.includes('system')) {
            promises.push(this.pool.query('DELETE FROM system_logs WHERE timestamp < $1', [cutoff]));
        }

        await Promise.all(promises);
    }

    async cleanupQrCache(): Promise<void> {
        const threshold = Date.now() - 1 * 60 * 1000;
        await this.pool.query('DELETE FROM cache WHERE key LIKE \'qr:%\' AND expires_at < $1', [threshold]);
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
            isDefault: row.is_default,
            enabled: row.enabled,
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
            isDefault: row.is_default,
            enabled: row.enabled,
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
                name, url, cache_duration, is_default, enabled,
                last_updated, status, error, traffic, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            source.name,
            source.url,
            source.cacheDuration || 24,
            source.isDefault || false,
            source.enabled !== false,
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

        if (source.isDefault !== undefined) {
            updates.push(`is_default = $${paramIndex++}`);
            values.push(source.isDefault);
        }
        if (source.enabled !== undefined) {
            updates.push(`enabled = $${paramIndex++}`);
            values.push(source.enabled);
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
        // Also delete associated config (prefixed with "name::")
        await this.pool.query('DELETE FROM upstream_config WHERE key LIKE $1', [`${name}::%`]);
    }

    async setDefaultUpstreamSource(name: string): Promise<void> {
        // First, unset all defaults
        await this.pool.query('UPDATE upstream_sources SET is_default = false');
        // Then set the specified one as default
        await this.pool.query('UPDATE upstream_sources SET is_default = true WHERE name = $1', [name]);
    }

    // Passkey operations
    async addPasskey(passkey: PasskeyCredentials): Promise<void> {
        await this.ensureInitialized();
        await this.pool.query(
            'INSERT INTO passkeys (id, user_id, public_key, counter, transports, name, aaguid, created_at, last_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [passkey.id, passkey.userId, passkey.publicKey, passkey.counter, JSON.stringify(passkey.transports), passkey.name, passkey.aaguid, passkey.createdAt, passkey.lastUsed]
        );
    }

    async getPasskey(id: string): Promise<PasskeyCredentials | null> {
        await this.ensureInitialized();
        const result = await this.pool.query('SELECT * FROM passkeys WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            publicKey: row.public_key,
            counter: parseInt(row.counter),
            transports: row.transports || [],
            name: row.name,
            createdAt: parseInt(row.created_at),
            lastUsed: parseInt(row.last_used)
        };
    }

    async getUserPasskeys(userId: string): Promise<PasskeyCredentials[]> {
        await this.ensureInitialized();
        const result = await this.pool.query('SELECT * FROM passkeys WHERE user_id = $1 ORDER BY last_used DESC', [userId]);
        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            publicKey: row.public_key,
            counter: parseInt(row.counter),
            transports: row.transports as string[],
            name: row.name,
            aaguid: row.aaguid,
            createdAt: parseInt(row.created_at),
            lastUsed: parseInt(row.last_used)
        }));
    }

    async deletePasskey(id: string, userId: string): Promise<void> {
        await this.pool.query('DELETE FROM passkeys WHERE id = $1 AND user_id = $2', [id, userId]);
    }

    async updatePasskeyCounter(id: string, counter: number): Promise<void> {
        await this.pool.query('UPDATE passkeys SET counter = $1, last_used = $2 WHERE id = $3', [counter, Date.now(), id]);
    }
}
