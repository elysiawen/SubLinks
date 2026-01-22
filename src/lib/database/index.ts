
import { IDatabase } from './interface';
import PostgresDatabase from './postgres';

export function getDatabase(): IDatabase {
    // Default to Postgres
    return new PostgresDatabase();
}
