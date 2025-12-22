import { IDatabase } from './interface';
import RedisDatabase from './redis';
import PostgresDatabase from './postgres';
import MemoryPostgresDatabase from './memory-postgres';

export function getDatabase(): IDatabase {
    // Check if we should use in-memory database for development
    const useMemory = process.env.USE_MEMORY_DB === 'true';

    if (useMemory) {
        console.log('🧠 Development mode: Using in-memory database');
        return new MemoryPostgresDatabase();
    }

    const dbType = process.env.DATABASE_TYPE || 'redis';

    switch (dbType.toLowerCase()) {
        case 'postgres':
        case 'postgresql':
            console.log('Using PostgreSQL database');
            return new PostgresDatabase();

        case 'redis':
        default:
            console.log('Using Redis database');
            return new RedisDatabase();
    }
}
