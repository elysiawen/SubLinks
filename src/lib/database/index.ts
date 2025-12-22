
import { IDatabase } from './interface';
import RedisDatabase from './redis';
import PostgresDatabase from './postgres';

export function getDatabase(): IDatabase {
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
