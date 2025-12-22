import { getDatabase } from './database';
import { IDatabase } from './database/interface';

// Singleton database instance
export const db: IDatabase = getDatabase();
