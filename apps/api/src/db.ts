import mysql from 'mysql2/promise';
import type { Logger } from './logger.js';

export interface Database {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(databaseUrl: string, logger: Logger): Database {
  const pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 5,
    enableKeepAlive: true,
  });

  return {
    async ping(): Promise<void> {
      try {
        await pool.query('SELECT 1');
      } catch (error) {
        logger.warn({ err: error }, 'database ping failed');
        throw error;
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
