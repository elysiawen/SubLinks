import { IDatabase } from './interface';
import { newDb, IMemoryDb } from 'pg-mem';
import PostgresDatabase from './postgres';

/**
 * In-memory PostgreSQL database using pg-mem
 * Perfect for development - data is cleared on restart
 */
export default class MemoryPostgresDatabase extends PostgresDatabase {
    private memDb: IMemoryDb;

    constructor() {
        // Create in-memory database
        const memDb = newDb();

        // Enable some PostgreSQL extensions that might be needed
        memDb.public.registerFunction({
            name: 'current_database',
            returns: 'text',
            implementation: () => 'memdb',
        });

        memDb.public.registerFunction({
            name: 'version',
            returns: 'text',
            implementation: () => 'PostgreSQL 15.0 (pg-mem)',
        });

        // Get pg-compatible pool
        const { Pool } = memDb.adapters.createPg();
        const pool = new Pool();

        // Call parent constructor with the in-memory pool
        // @ts-ignore - we're passing a compatible pool
        super();

        // Replace the pool with our in-memory one
        // @ts-ignore - accessing private property
        this.pool = pool;
        this.memDb = memDb;

        console.log('🧠 Using IN-MEMORY PostgreSQL database (pg-mem)');
        console.log('⚠️  Data will be cleared on restart!');
    }
}
