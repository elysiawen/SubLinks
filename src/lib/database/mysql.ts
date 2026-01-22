import { createPool, Pool } from 'mysql2/promise';
import { IDatabase, User, Session, SubData, ConfigSet, GlobalConfig, Proxy, ProxyGroup, Rule, PaginatedResult, RefreshToken, UpstreamSource, APIAccessLog, WebAccessLog, SystemLog } from './interface';
import { nanoid } from 'nanoid';
import { randomUUID } from 'crypto';

export default class MysqlDatabase implements IDatabase {
    private pool: Pool;
    private initialized: boolean = false;

    constructor() {
        if (!process.env.MYSQL_URL) {
            throw new Error('MYSQL_URL environment variable is required for MySQL database');
        }

        this.pool = createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            multipleStatements: true, // Required for initTables script
            dateStrings: true, // Return dates as strings to handle BigInts/Dates uniformly if needed
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
    }

    private async ensureInitialized() {
        if (this.initialized) return;

        try {
            await this.initTables();
            this.initialized = true;
        } catch (err) {
            console.error('Failed to initialize MySQL tables:', err);
        }
    }

    private async query<T extends any = any>(sql: string, params: any[] = []): Promise<[T, any]> {
        let lastError;
        for (let i = 0; i < 3; i++) {
            try {
                return await this.pool.query(sql, params) as any;
            } catch (error: any) {
                lastError = error;
                if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'EPIPE') {
                    // console.warn(`Retrying query due to ${error.code} (Attempt ${i + 1}/3)`);
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    private async initTables() {
        // MySQL Schema Definition
        // Using CHAR(36) for UUIDs
        // Using JSON for JSONB
        // Using BIGINT for Timestamps
        // Using TINYINT(1) for Boolean
        const sql = `
            CREATE TABLE IF NOT EXISTS global_config (
                \`key\` VARCHAR(255) PRIMARY KEY,
                \`value\` LONGTEXT NOT NULL,
                updated_at BIGINT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL,
                max_subscriptions INTEGER,
                token_version INTEGER DEFAULT 0,
                nickname VARCHAR(100),
                avatar TEXT,
                created_at BIGINT NOT NULL,
                INDEX idx_users_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS subscriptions (
                token VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                remark VARCHAR(255),
                group_id VARCHAR(255),
                rule_id VARCHAR(255),
                custom_rules TEXT,
                selected_sources JSON,
                enabled TINYINT(1) DEFAULT 1,
                created_at BIGINT NOT NULL,
                INDEX idx_subscriptions_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                created_at BIGINT NOT NULL DEFAULT 0,
                expires_at BIGINT NOT NULL,
                user_id CHAR(36),
                token_version INTEGER DEFAULT 0,
                nickname VARCHAR(100),
                avatar TEXT,
                ip VARCHAR(45),
                ua TEXT,
                device_info VARCHAR(255),
                last_active BIGINT DEFAULT 0,
                INDEX idx_sessions_username (username),
                INDEX idx_sessions_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id VARCHAR(255) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                username VARCHAR(255) NOT NULL,
                token TEXT NOT NULL,
                ip VARCHAR(45),
                ua TEXT,
                device_info VARCHAR(255),
                created_at BIGINT NOT NULL,
                expires_at BIGINT NOT NULL,
                last_active BIGINT NOT NULL,
                INDEX idx_refresh_tokens_user (user_id),
                INDEX idx_refresh_tokens_token (token(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE IF NOT EXISTS custom_config (
                id VARCHAR(255) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                type VARCHAR(50) NOT NULL, -- 'group' or 'rule'
                name VARCHAR(255) NOT NULL,
                content TEXT,
                is_global TINYINT(1) DEFAULT 0,
                updated_at BIGINT NOT NULL,
                INDEX idx_config_user (user_id),
                INDEX idx_config_type (type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS upstream_sources (
                name VARCHAR(255) PRIMARY KEY,
                url TEXT NOT NULL,
                cache_duration INTEGER DEFAULT 60,
                is_default TINYINT(1) DEFAULT 0,
                last_updated BIGINT,
                status VARCHAR(50),
                error TEXT,
                traffic_upload BIGINT DEFAULT 0,
                traffic_download BIGINT DEFAULT 0,
                traffic_total BIGINT DEFAULT 0,
                traffic_expire BIGINT DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS cache (
                \`key\` VARCHAR(255) PRIMARY KEY,
                value LONGTEXT NOT NULL,
                expires_at BIGINT NOT NULL,
                INDEX idx_cache_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS proxies (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                type VARCHAR(50),
                source VARCHAR(255),
                config JSON,
                created_at BIGINT,
                INDEX idx_proxies_source (source)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS proxy_groups (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                type VARCHAR(50),
                source VARCHAR(255),
                proxies JSON,
                config JSON,
                priority INTEGER DEFAULT 0,
                created_at BIGINT,
                INDEX idx_groups_source (source)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS rules (
                id VARCHAR(255) PRIMARY KEY,
                rule_text TEXT,
                priority INTEGER DEFAULT 0,
                source VARCHAR(255),
                created_at BIGINT,
                INDEX idx_rules_source (source)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS upstream_config (
                 \`key\` VARCHAR(255),
                 value JSON,
                 source VARCHAR(255),
                 PRIMARY KEY (\`key\`, source)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

             CREATE TABLE IF NOT EXISTS api_access_logs (
                id CHAR(36) PRIMARY KEY,
                token VARCHAR(255),
                username VARCHAR(255),
                nickname VARCHAR(255),
                ip VARCHAR(45),
                ua TEXT,
                status INTEGER,
                timestamp BIGINT,
                api_type VARCHAR(50),
                request_method VARCHAR(20),
                INDEX idx_api_logs_username (username),
                INDEX idx_api_logs_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS web_access_logs (
                id CHAR(36) PRIMARY KEY,
                path VARCHAR(255),
                ip VARCHAR(45),
                ua TEXT,
                username VARCHAR(255),
                nickname VARCHAR(255),
                status INTEGER,
                timestamp BIGINT,
                INDEX idx_web_logs_username (username),
                INDEX idx_web_logs_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS system_logs (
                id CHAR(36) PRIMARY KEY,
                category VARCHAR(50),
                message TEXT,
                details JSON,
                status VARCHAR(20),
                timestamp BIGINT,
                INDEX idx_sys_logs_category (category),
                INDEX idx_sys_logs_timestamp (timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await this.pool.query(sql);
    }

    // User Operations
    async getUser(username: string): Promise<User | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return null;

        const row = rows[0];
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
            createdAt: Number(row.created_at)
        };
    }

    async getUserById(id: string): Promise<User | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) return null;

        const row = rows[0];
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
            createdAt: Number(row.created_at)
        };
    }

    async setUser(username: string, data: User): Promise<void> {
        await this.ensureInitialized();

        // Check if user exists to decide on ID
        const existing = await this.getUser(username);
        const id = existing?.id || randomUUID();

        // MySQL UPSERT: INSERT ... ON DUPLICATE KEY UPDATE
        await this.pool.query(
            `INSERT INTO users (id, username, password, role, status, max_subscriptions, token_version, nickname, avatar, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 password = VALUES(password),
                 role = VALUES(role),
                 status = VALUES(status),
                 max_subscriptions = VALUES(max_subscriptions),
                 token_version = VALUES(token_version),
                 nickname = VALUES(nickname),
                 avatar = VALUES(avatar)`,
            [id, username, data.password, data.role, data.status, data.maxSubscriptions, data.tokenVersion || 0, data.nickname, data.avatar, data.createdAt]
        );
    }

    async deleteUser(username: string): Promise<void> {
        await this.pool.query('DELETE FROM users WHERE username = ?', [username]);
    }

    async getAllUsers(page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResult<User & { username: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM users';
        let params: any[] = [];

        if (search) {
            query += ' WHERE username LIKE ? OR nickname LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        // MySQL LIMIT requires integer
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        // Count query
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let countParams: any[] = [];

        if (search) {
            countQuery += ' WHERE username LIKE ? OR nickname LIKE ?';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countRows] = await this.pool.query<any[]>(countQuery, countParams);

        return {
            data: rows.map(row => ({
                id: row.id,
                username: row.username,
                password: row.password,
                role: row.role,
                status: row.status,
                maxSubscriptions: row.max_subscriptions,
                tokenVersion: row.token_version,
                nickname: row.nickname,
                avatar: row.avatar,
                createdAt: Number(row.created_at)
            })),
            total: countRows[0].total
        };
    }

    async userExists(username: string): Promise<boolean> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT 1 FROM users WHERE username = ?', [username]);
        return rows.length > 0;
    }

    // Session Operations
    async createSession(sessionId: string, data: Session, ttl: number): Promise<void> {
        await this.ensureInitialized();
        const expiresAt = Date.now() + (ttl * 1000);

        await this.pool.query(
            `INSERT INTO sessions (session_id, username, role, created_at, expires_at, user_id, token_version, nickname, avatar, ip, ua, device_info, last_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                role = VALUES(role),
                expires_at = VALUES(expires_at),
                token_version = VALUES(token_version),
                nickname = VALUES(nickname),
                avatar = VALUES(avatar),
                last_active = VALUES(last_active)`,
            [sessionId, data.username, data.role, Date.now(), expiresAt, data.userId, data.tokenVersion || 0, data.nickname, data.avatar, data.ip, data.ua, data.deviceInfo, data.lastActive || Date.now()]
        );
    }

    async getSession(sessionId: string, currentIp?: string): Promise<Session | null> {
        if (!sessionId) return null;
        await this.ensureInitialized();

        // Lazy cleanup
        if (Math.random() < 0.1) {
            this.cleanupExpiredSessions();
        }

        const [rows] = await this.query<any[]>('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?', [sessionId, Date.now()]);
        if (rows.length === 0) return null;

        const row = rows[0];
        const lastActive = Number(row.last_active);
        const storedIp = row.ip;

        // If IP Changed, update immediately (reset last_active too because it's an activity)
        if (currentIp && currentIp !== storedIp) {
            await this.query('UPDATE sessions SET ip = ?, last_active = ? WHERE session_id = ?', [currentIp, Date.now(), sessionId]);
        }
        // Otherwise, optimize: Update last active only if more than 60 seconds have passed
        else if (Date.now() - lastActive > 60 * 1000) {
            await this.query('UPDATE sessions SET last_active = ? WHERE session_id = ?', [Date.now(), sessionId]);
        }

        return {
            userId: row.user_id,
            username: row.username,
            role: row.role,
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            ip: row.ip,
            ua: row.ua,
            deviceInfo: row.device_info,
            lastActive: Number(row.last_active)
        };
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
    }

    async deleteUserSession(userId: string, sessionId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE session_id = ? AND user_id = ?', [sessionId, userId]);
    }

    async getUserSessions(userId: string): Promise<Session[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_active DESC', [userId, Date.now()]);

        return rows.map(row => ({
            sessionId: row.session_id, // Add sessionId to return type if needed by caller, but interface matches Session
            userId: row.user_id,
            username: row.username,
            role: row.role,
            tokenVersion: row.token_version,
            nickname: row.nickname,
            avatar: row.avatar,
            ip: row.ip,
            ua: row.ua,
            deviceInfo: row.device_info,
            lastActive: Number(row.last_active)
        }));
    }

    async getAllSessions(page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResult<Session & { sessionId: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM sessions WHERE expires_at > ?';
        let params: any[] = [Date.now()];

        if (search) {
            query += ' AND (username LIKE ? OR nickname LIKE ? OR ip LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY last_active DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        // Count
        let countQuery = 'SELECT COUNT(*) as total FROM sessions WHERE expires_at > ?';
        let countParams: any[] = [Date.now()];

        if (search) {
            countQuery += ' AND (username LIKE ? OR nickname LIKE ? OR ip LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [countRows] = await this.pool.query<any[]>(countQuery, countParams);

        return {
            data: rows.map(row => ({
                sessionId: row.session_id,
                userId: row.user_id,
                username: row.username,
                role: row.role,
                tokenVersion: row.token_version,
                nickname: row.nickname,
                avatar: row.avatar,
                ip: row.ip,
                ua: row.ua,
                deviceInfo: row.device_info,
                lastActive: Number(row.last_active)
            })),
            total: countRows[0].total
        };
    }

    async deleteAllUserSessions(userId: string): Promise<void> {
        await this.pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
    }

    async cleanupExpiredSessions(): Promise<number> {
        const [result] = await this.query<any>('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
        return result.affectedRows;
    }

    // Refresh Tokens
    async createRefreshToken(token: RefreshToken): Promise<void> {
        await this.ensureInitialized();
        await this.pool.query(
            `INSERT INTO refresh_tokens (id, user_id, username, token, ip, ua, device_info, created_at, expires_at, last_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [token.id, token.userId, token.username, token.token, token.ip, token.ua, token.deviceInfo, token.createdAt, token.expiresAt, token.lastActive]
        );
    }

    async getRefreshToken(tokenString: string): Promise<RefreshToken | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM refresh_tokens WHERE token = ?', [tokenString]);
        if (rows.length === 0) return null;

        const row = rows[0];
        // Update last active
        await this.pool.query('UPDATE refresh_tokens SET last_active = ? WHERE id = ?', [Date.now(), row.id]);

        return {
            id: row.id,
            userId: row.user_id,
            username: row.username,
            token: row.token,
            ip: row.ip,
            ua: row.ua,
            deviceInfo: row.device_info,
            createdAt: Number(row.created_at),
            expiresAt: Number(row.expires_at),
            lastActive: Number(row.last_active)
        };
    }

    async deleteRefreshToken(tokenString: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE token = ?', [tokenString]);
    }

    async deleteRefreshTokenById(id: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE id = ?', [id]);
    }

    async deleteUserRefreshToken(userId: string, tokenId: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?', [tokenId, userId]);
    }

    async deleteAllUserRefreshTokens(userId: string): Promise<void> {
        await this.pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    }

    async getUserRefreshTokens(userId: string): Promise<RefreshToken[]> {
        await this.ensureInitialized();
        // Cleanup
        await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < ?', [Date.now()]);

        const [rows] = await this.pool.query<any[]>('SELECT * FROM refresh_tokens WHERE user_id = ? ORDER BY last_active DESC', [userId]);

        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            username: row.username,
            token: row.token,
            ip: row.ip,
            ua: row.ua,
            deviceInfo: row.device_info,
            createdAt: Number(row.created_at),
            expiresAt: Number(row.expires_at),
            lastActive: Number(row.last_active)
        }));
    }

    async getAllRefreshTokens(page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResult<RefreshToken>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        // Cleanup first
        await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < ?', [Date.now()]);

        let query = 'SELECT * FROM refresh_tokens';
        let params: any[] = [];

        if (search) {
            query += ' WHERE username LIKE ? OR ip LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY last_active DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        // Count
        let countQuery = 'SELECT COUNT(*) as total FROM refresh_tokens';
        let countParams: any[] = [];

        if (search) {
            countQuery += ' WHERE username LIKE ? OR ip LIKE ?';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countRows] = await this.pool.query<any[]>(countQuery, countParams);

        return {
            data: rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                username: row.username,
                token: row.token,
                ip: row.ip,
                ua: row.ua,
                deviceInfo: row.device_info,
                createdAt: Number(row.created_at),
                expiresAt: Number(row.expires_at),
                lastActive: Number(row.last_active)
            })),
            total: countRows[0].total
        };
    }

    async cleanupExpiredRefreshTokens(): Promise<number> {
        const [result] = await this.pool.query<any>('DELETE FROM refresh_tokens WHERE expires_at < ?', [Date.now()]);
        return result.affectedRows;
    }

    // Subscription Operations
    async createSubscription(token: string, username: string, data: SubData): Promise<void> {
        await this.ensureInitialized();
        const existingUser = await this.getUser(username);
        // We assume we want to use the JSON column for selected_sources

        await this.pool.query(
            `INSERT INTO subscriptions (token, username, remark, group_id, rule_id, custom_rules, selected_sources, enabled, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [token, username, data.remark, data.groupId, data.ruleId, data.customRules, JSON.stringify(data.selectedSources || []), data.enabled, data.createdAt]
        );
    }

    async getSubscription(token: string): Promise<(SubData & { token: string }) | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM subscriptions WHERE token = ?', [token]);
        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: typeof row.selected_sources === 'string' ? JSON.parse(row.selected_sources) : row.selected_sources,
            enabled: !!row.enabled,
            createdAt: Number(row.created_at)
        };
    }

    async deleteSubscription(token: string, username: string): Promise<void> {
        // Technically username check is good for security ownership verification
        await this.pool.query('DELETE FROM subscriptions WHERE token = ? AND username = ?', [token, username]);
    }

    async updateSubscription(token: string, data: SubData): Promise<void> {
        await this.pool.query(
            `UPDATE subscriptions SET 
                remark = ?, 
                group_id = ?, 
                rule_id = ?, 
                custom_rules = ?, 
                selected_sources = ?, 
                enabled = ?
             WHERE token = ?`,
            [data.remark, data.groupId, data.ruleId, data.customRules, JSON.stringify(data.selectedSources || []), data.enabled, token]
        );
    }

    async getUserSubscriptions(username: string): Promise<Array<SubData & { token: string }>> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM subscriptions WHERE username = ? ORDER BY created_at DESC', [username]);

        return rows.map(row => ({
            token: row.token,
            username: row.username,
            remark: row.remark,
            groupId: row.group_id,
            ruleId: row.rule_id,
            customRules: row.custom_rules,
            selectedSources: typeof row.selected_sources === 'string' ? JSON.parse(row.selected_sources) : row.selected_sources,
            enabled: !!row.enabled,
            createdAt: Number(row.created_at)
        }));
    }

    async getAllSubscriptions(page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResult<SubData & { token: string }>> {
        await this.ensureInitialized();
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM subscriptions';
        let params: any[] = [];

        if (search) {
            query += ' WHERE username LIKE ? OR remark LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        let countQuery = 'SELECT COUNT(*) as total FROM subscriptions';
        let countParams: any[] = [];
        if (search) {
            countQuery += ' WHERE username LIKE ? OR remark LIKE ?';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countRows] = await this.pool.query<any[]>(countQuery, countParams);

        return {
            data: rows.map(row => ({
                token: row.token,
                username: row.username,
                remark: row.remark,
                groupId: row.group_id,
                ruleId: row.rule_id,
                customRules: row.custom_rules,
                selectedSources: typeof row.selected_sources === 'string' ? JSON.parse(row.selected_sources) : row.selected_sources,
                enabled: !!row.enabled,
                createdAt: Number(row.created_at)
            })),
            total: countRows[0].total
        };
    }

    async isSubscriptionOwner(username: string, token: string): Promise<boolean> {
        const [rows] = await this.pool.query<any[]>('SELECT 1 FROM subscriptions WHERE token = ? AND username = ?', [token, username]);
        return rows.length > 0;
    }

    // Config & Other Operations
    async getGlobalConfig(): Promise<GlobalConfig> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM global_config');

        const config: any = {};
        rows.forEach(row => {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch {
                config[row.key] = row.value;
            }
        });

        return {
            maxUserSubscriptions: config.maxUserSubscriptions ?? 10,
            logRetentionDays: config.logRetentionDays ?? 30,
            ...config
        };
    }

    async setGlobalConfig(data: GlobalConfig): Promise<void> {
        await this.ensureInitialized();
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const now = Date.now();

            for (const [key, value] of Object.entries(data)) {
                if (value === undefined) continue;
                await connection.query(
                    `INSERT INTO global_config (\`key\`, \`value\`, updated_at) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = VALUES(updated_at)`,
                    [key, JSON.stringify(value), now]
                );
            }
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }

    // Custom Groups/Rules
    async getCustomGroups(userId: string): Promise<ConfigSet[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM custom_config WHERE (user_id = ? OR is_global = 1) AND type = "group" ORDER BY updated_at DESC', [userId]);
        return rows.map(this.mapConfigSet);
    }

    async getCustomGroup(id: string, userId: string): Promise<ConfigSet | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM custom_config WHERE id = ? AND (user_id = ? OR is_global = 1) AND type = "group"', [id, userId]);
        return rows.length > 0 ? this.mapConfigSet(rows[0]) : null;
    }

    async saveCustomGroup(id: string | null, userId: string, name: string, content: string, isGlobal: boolean = false): Promise<void> {
        await this.ensureInitialized();
        const realId = id || nanoid();
        await this.pool.query(
            `INSERT INTO custom_config (id, user_id, type, name, content, is_global, updated_at)
             VALUES (?, ?, "group", ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), content=VALUES(content), is_global=VALUES(is_global), updated_at=VALUES(updated_at)`,
            [realId, userId, name, content, isGlobal, Date.now()]
        );
    }

    async deleteCustomGroup(id: string, userId: string): Promise<void> {
        await this.pool.query('DELETE FROM custom_config WHERE id = ? AND user_id = ? AND type = "group"', [id, userId]);
    }

    async getCustomRules(userId: string): Promise<ConfigSet[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM custom_config WHERE (user_id = ? OR is_global = 1) AND type = "rule" ORDER BY updated_at DESC', [userId]);
        return rows.map(this.mapConfigSet);
    }

    async getCustomRule(id: string, userId: string): Promise<ConfigSet | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM custom_config WHERE id = ? AND (user_id = ? OR is_global = 1) AND type = "rule"', [id, userId]);
        return rows.length > 0 ? this.mapConfigSet(rows[0]) : null;
    }

    async saveCustomRule(id: string | null, userId: string, name: string, content: string, isGlobal: boolean = false): Promise<void> {
        await this.ensureInitialized();
        const realId = id || nanoid();
        await this.pool.query(
            `INSERT INTO custom_config (id, user_id, type, name, content, is_global, updated_at)
              VALUES (?, ?, "rule", ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE name=VALUES(name), content=VALUES(content), is_global=VALUES(is_global), updated_at=VALUES(updated_at)`,
            [realId, userId, name, content, isGlobal, Date.now()]
        );
    }

    async deleteCustomRule(id: string, userId: string): Promise<void> {
        await this.pool.query('DELETE FROM custom_config WHERE id = ? AND user_id = ? AND type = "rule"', [id, userId]);
    }

    async getAllCustomGroups(): Promise<ConfigSet[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT t1.*, t2.username FROM custom_config t1 JOIN users t2 ON t1.user_id = t2.id WHERE t1.type = "group" ORDER BY t1.updated_at DESC');
        return rows.map(row => ({ ...this.mapConfigSet(row), username: row.username }));
    }

    async getAllCustomRules(): Promise<ConfigSet[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT t1.*, t2.username FROM custom_config t1 JOIN users t2 ON t1.user_id = t2.id WHERE t1.type = "rule" ORDER BY t1.updated_at DESC');
        return rows.map(row => ({ ...this.mapConfigSet(row), username: row.username }));
    }

    private mapConfigSet(row: any): ConfigSet {
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            updatedAt: Number(row.updated_at),
            userId: row.user_id,
            isGlobal: !!row.is_global
        };
    }

    // Upstream Sources
    async getUpstreamSources(): Promise<UpstreamSource[]> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM upstream_sources ORDER BY name ASC');
        return rows.map(this.mapUpstreamSource);
    }

    async getUpstreamSource(name: string): Promise<UpstreamSource | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM upstream_sources WHERE name = ?', [name]);
        return rows.length > 0 ? this.mapUpstreamSource(rows[0]) : null;
    }

    async getUpstreamSourceByName(name: string): Promise<UpstreamSource | null> {
        return this.getUpstreamSource(name);
    }

    async createUpstreamSource(source: UpstreamSource): Promise<void> {
        await this.ensureInitialized();
        await this.pool.query(
            `INSERT INTO upstream_sources (name, url, cache_duration, is_default, last_updated, status, error, traffic_upload, traffic_download, traffic_total, traffic_expire)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [source.name, source.url, source.cacheDuration || 60, source.isDefault, source.lastUpdated || 0, source.status || 'pending', source.error, 0, 0, 0, 0]
        );
    }

    async updateUpstreamSource(name: string, source: Partial<UpstreamSource>): Promise<void> {
        const updates: string[] = [];
        const params: any[] = [];

        if (source.url !== undefined) { updates.push('url = ?'); params.push(source.url); }
        if (source.cacheDuration !== undefined) { updates.push('cache_duration = ?'); params.push(source.cacheDuration); }
        if (source.isDefault !== undefined) { updates.push('is_default = ?'); params.push(source.isDefault); }
        if (source.lastUpdated !== undefined) { updates.push('last_updated = ?'); params.push(source.lastUpdated); }
        if (source.status !== undefined) { updates.push('status = ?'); params.push(source.status); }
        if (source.error !== undefined) { updates.push('error = ?'); params.push(source.error); }

        if (source.traffic) {
            updates.push('traffic_upload = ?'); params.push(source.traffic.upload);
            updates.push('traffic_download = ?'); params.push(source.traffic.download);
            updates.push('traffic_total = ?'); params.push(source.traffic.total);
            updates.push('traffic_expire = ?'); params.push(source.traffic.expire);
        }

        if (updates.length > 0) {
            params.push(name);
            await this.pool.query(`UPDATE upstream_sources SET ${updates.join(', ')} WHERE name = ?`, params);
        }
    }

    async deleteUpstreamSource(name: string): Promise<void> {
        await this.pool.query('DELETE FROM upstream_sources WHERE name = ?', [name]);
    }

    async setDefaultUpstreamSource(name: string): Promise<void> {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('UPDATE upstream_sources SET is_default = 0');
            await connection.query('UPDATE upstream_sources SET is_default = 1 WHERE name = ?', [name]);
            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }

    private mapUpstreamSource(row: any): UpstreamSource {
        return {
            name: row.name,
            url: row.url,
            cacheDuration: row.cache_duration,
            isDefault: !!row.is_default,
            lastUpdated: Number(row.last_updated),
            status: row.status,
            error: row.error,
            traffic: {
                upload: Number(row.traffic_upload),
                download: Number(row.traffic_download),
                total: Number(row.traffic_total),
                expire: Number(row.traffic_expire)
            }
        };
    }

    // Cache
    async getCache(key: string): Promise<string | null> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT value FROM cache WHERE `key` = ? AND expires_at > ?', [key, Date.now()]);
        return rows.length > 0 ? rows[0].value : null;
    }

    async setCache(key: string, value: string, ttl: number = 3600): Promise<void> {
        await this.ensureInitialized();
        const expiresAt = Date.now() + (ttl * 1000);
        await this.pool.query(
            'INSERT INTO cache (`key`, value, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), expires_at = VALUES(expires_at)',
            [key, value, expiresAt]
        );
    }

    async deleteCache(key: string): Promise<void> {
        await this.pool.query('DELETE FROM cache WHERE `key` = ?', [key]);
    }

    async clearAllSubscriptionCaches(): Promise<void> {
        await this.pool.query('DELETE FROM cache WHERE `key` LIKE "cache:subscription:%"');
    }

    // Structured Data
    async saveProxies(proxies: Proxy[]): Promise<void> {
        await this.ensureInitialized();
        if (proxies.length === 0) return;

        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const CHUNK_SIZE = 1000;
            for (let i = 0; i < proxies.length; i += CHUNK_SIZE) {
                const chunk = proxies.slice(i, i + CHUNK_SIZE);
                const values: any[] = [];
                const placeholders: string[] = [];

                for (const p of chunk) {
                    placeholders.push('(?, ?, ?, ?, ?, ?)');
                    values.push(p.id, p.name, p.type, p.source, JSON.stringify(p.config), p.createdAt);
                }

                const sql = `
                    INSERT INTO proxies (id, name, type, source, config, created_at) 
                    VALUES ${placeholders.join(', ')} 
                    ON DUPLICATE KEY UPDATE 
                        name=VALUES(name), 
                        type=VALUES(type), 
                        config=VALUES(config), 
                        created_at=VALUES(created_at)
                `;

                await connection.query(sql, values);
            }

            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }

    async getProxies(source?: string): Promise<Proxy[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM proxies';
        let params: any[] = [];
        if (source) {
            query += ' WHERE source = ?';
            params.push(source);
        }
        const [rows] = await this.pool.query<any[]>(query, params);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            source: row.source,
            config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
            createdAt: Number(row.created_at)
        }));
    }

    async clearProxies(source: string): Promise<void> {
        await this.pool.query('DELETE FROM proxies WHERE source = ?', [source]);
    }

    async saveProxyGroups(groups: ProxyGroup[]): Promise<void> {
        await this.ensureInitialized();
        if (groups.length === 0) return;

        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const CHUNK_SIZE = 1000;
            for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
                const chunk = groups.slice(i, i + CHUNK_SIZE);
                const values: any[] = [];
                const placeholders: string[] = [];

                for (const g of chunk) {
                    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
                    values.push(g.id, g.name, g.type, g.source, JSON.stringify(g.proxies), JSON.stringify(g.config), g.priority, g.createdAt);
                }

                const sql = `
                    INSERT INTO proxy_groups (id, name, type, source, proxies, config, priority, created_at) 
                    VALUES ${placeholders.join(', ')} 
                    ON DUPLICATE KEY UPDATE 
                        name=VALUES(name), 
                        type=VALUES(type), 
                        proxies=VALUES(proxies), 
                        config=VALUES(config), 
                        priority=VALUES(priority), 
                        created_at=VALUES(created_at)
                `;

                await connection.query(sql, values);
            }

            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }

    async getProxyGroups(source?: string): Promise<ProxyGroup[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM proxy_groups';
        let params: any[] = [];
        if (source) {
            query += ' WHERE source = ?';
            params.push(source);
        }
        query += ' ORDER BY priority DESC'; // Higher priority first
        const [rows] = await this.pool.query<any[]>(query, params);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            source: row.source,
            proxies: typeof row.proxies === 'string' ? JSON.parse(row.proxies) : row.proxies,
            config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
            priority: row.priority,
            createdAt: Number(row.created_at)
        }));
    }

    async clearProxyGroups(source: string): Promise<void> {
        await this.pool.query('DELETE FROM proxy_groups WHERE source = ?', [source]);
    }

    async saveRules(rules: Rule[]): Promise<void> {
        await this.ensureInitialized();
        if (rules.length === 0) return;

        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // Batch insert in chunks to avoid packet size limits
            const CHUNK_SIZE = 1000;
            for (let i = 0; i < rules.length; i += CHUNK_SIZE) {
                const chunk = rules.slice(i, i + CHUNK_SIZE);
                const values: any[] = [];
                const placeholders: string[] = [];

                for (const r of chunk) {
                    placeholders.push('(?, ?, ?, ?, ?)');
                    values.push(r.id, r.ruleText, r.priority, r.source, r.createdAt);
                }

                const sql = `
                    INSERT INTO rules (id, rule_text, priority, source, created_at) 
                    VALUES ${placeholders.join(', ')} 
                    ON DUPLICATE KEY UPDATE 
                        rule_text=VALUES(rule_text), 
                        priority=VALUES(priority), 
                        created_at=VALUES(created_at)
                `;

                await connection.query(sql, values);
            }

            await connection.commit();
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    }

    async getRules(source?: string): Promise<Rule[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM rules';
        let params: any[] = [];
        if (source) {
            query += ' WHERE source = ?';
            params.push(source);
        }
        query += ' ORDER BY priority DESC';
        const [rows] = await this.pool.query<any[]>(query, params);
        return rows.map(row => ({
            id: row.id,
            ruleText: row.rule_text,
            priority: row.priority,
            source: row.source,
            createdAt: Number(row.created_at)
        }));
    }

    async clearRules(source: string): Promise<void> {
        await this.pool.query('DELETE FROM rules WHERE source = ?', [source]);
    }

    async saveUpstreamConfigItem(key: string, value: any, source: string = 'global'): Promise<void> {
        await this.ensureInitialized();
        await this.pool.query(
            'INSERT INTO upstream_config (`key`, value, source) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
            [key, JSON.stringify(value), source]
        );
    }

    async getUpstreamConfigItem(key: string): Promise<any> {
        await this.ensureInitialized();
        // Priority: global > others (simplified for now, just get first)
        const [rows] = await this.pool.query<any[]>('SELECT value FROM upstream_config WHERE `key` = ?', [key]);
        if (rows.length > 0) {
            return typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        }
        return null;
    }

    async getAllUpstreamConfig(): Promise<Record<string, any>> {
        await this.ensureInitialized();
        const [rows] = await this.pool.query<any[]>('SELECT * FROM upstream_config');
        const config: any = {};
        rows.forEach(row => {
            const key = row.source === 'global' ? row.key : `${row.key}@${row.source}`;
            config[key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        });
        return config;
    }

    async getUpstreamConfig(sources?: string[]): Promise<Record<string, any>> {
        await this.ensureInitialized();
        // Select global + specified sources
        let query = 'SELECT * FROM upstream_config WHERE source = "global"';
        const params: any[] = [];

        if (sources && sources.length > 0) {
            query += ' OR source IN (?)';
            params.push(sources);
        }

        // Note: mysql2 handles array param for IN clause
        const [rows] = await this.pool.query<any[]>(query, params);

        const config: any = {};
        rows.forEach(row => {
            // For merging, we normally want latest or priority.
            // Here we just return them, maybe overwriting if collision?
            // Implementation details depend on usage.
            config[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        });
        return config;
    }

    // Logs
    async createAPIAccessLog(log: Omit<APIAccessLog, 'id'>): Promise<void> {
        await this.ensureInitialized();
        // Fire and forget (optional await)
        this.pool.query(
            'INSERT INTO api_access_logs (id, token, username, nickname, ip, ua, status, timestamp, api_type, request_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [randomUUID(), log.token, log.username, log.nickname, log.ip, log.ua, log.status, log.timestamp, log.apiType, log.requestMethod]
        ).catch(e => console.error('Log error', e));
    }

    async getAPIAccessLogs(limit: number, offset: number, search?: string): Promise<APIAccessLog[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM api_access_logs';
        const params: any[] = [];

        if (search) {
            query += ' WHERE username LIKE ? OR ip LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        return rows.map(row => ({
            id: row.id,
            token: row.token,
            username: row.username,
            nickname: row.nickname,
            ip: row.ip,
            ua: row.ua,
            status: row.status,
            timestamp: Number(row.timestamp),
            apiType: row.api_type,
            requestMethod: row.request_method
        }));
    }

    async createWebAccessLog(log: Omit<WebAccessLog, 'id'>): Promise<void> {
        await this.ensureInitialized();
        this.pool.query(
            'INSERT INTO web_access_logs (id, path, ip, ua, username, nickname, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [randomUUID(), log.path, log.ip, log.ua, log.username, log.nickname, log.status, log.timestamp]
        ).catch(e => console.error('Log error', e));
    }

    async getWebAccessLogs(limit: number, offset: number, search?: string): Promise<WebAccessLog[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM web_access_logs';
        const params: any[] = [];

        if (search) {
            query += ' WHERE username LIKE ? OR ip LIKE ? OR path LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);
        return rows.map(row => ({
            id: row.id,
            path: row.path,
            ip: row.ip,
            ua: row.ua,
            username: row.username,
            nickname: row.nickname,
            status: row.status,
            timestamp: Number(row.timestamp)
        }));
    }

    async createSystemLog(log: Omit<SystemLog, 'id'>): Promise<void> {
        await this.ensureInitialized();
        this.pool.query(
            'INSERT INTO system_logs (id, category, message, details, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [randomUUID(), log.category, log.message, JSON.stringify(log.details), log.status, log.timestamp]
        ).catch(e => console.error('Log error', e));
    }

    async getSystemLogs(limit: number, offset: number, search?: string): Promise<SystemLog[]> {
        await this.ensureInitialized();
        let query = 'SELECT * FROM system_logs';
        const params: any[] = [];
        if (search) {
            query += ' WHERE message LIKE ? OR category LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await this.pool.query<any[]>(query, params);

        return rows.map(row => ({
            id: row.id,
            category: row.category,
            message: row.message,
            details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
            status: row.status,
            timestamp: Number(row.timestamp)
        }));
    }

    async cleanupLogs(retentionDays: number): Promise<void> {
        const threshold = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        await Promise.all([
            this.pool.query('DELETE FROM api_access_logs WHERE timestamp < ?', [threshold]),
            this.pool.query('DELETE FROM web_access_logs WHERE timestamp < ?', [threshold]),
            this.pool.query('DELETE FROM system_logs WHERE timestamp < ?', [threshold])
        ]);
    }

    async deleteAllLogs(): Promise<void> {
        await Promise.all([
            this.pool.query('TRUNCATE TABLE api_access_logs'),
            this.pool.query('TRUNCATE TABLE web_access_logs'),
            this.pool.query('TRUNCATE TABLE system_logs')
        ]);
    }
}
