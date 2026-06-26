
import { IDatabase } from './interface';
import PostgresDatabase from './postgres';
import MysqlDatabase from './mysql';

let instance: IDatabase | null = null;

export function getDatabase(): IDatabase {
    if (instance) return instance;

    const dbType = process.env.DATABASE_TYPE || 'postgres';

    switch (dbType.toLowerCase()) {
        case 'mysql':
            console.log('Using MySQL database');
            instance = new MysqlDatabase();
            break;

        case 'postgres':
        case 'postgresql':
        default:
            console.log('Using PostgreSQL database');
            instance = new PostgresDatabase();
            break;
    }

    return instance;
}
