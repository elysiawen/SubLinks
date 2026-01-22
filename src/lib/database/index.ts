
import { IDatabase } from './interface';
import PostgresDatabase from './postgres';
import MysqlDatabase from './mysql';

export function getDatabase(): IDatabase {
    const dbType = process.env.DATABASE_TYPE || 'postgres';

    switch (dbType.toLowerCase()) {
        case 'mysql':
            console.log('Using MySQL database');
            return new MysqlDatabase();

        case 'postgres':
        case 'postgresql':
        default:
            console.log('Using PostgreSQL database');
            return new PostgresDatabase();
    }
}
