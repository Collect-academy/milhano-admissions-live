import postgres from 'postgres';
if (!process.env.DATABASE_URL) console.warn('DATABASE_URL missing; API cannot connect');
export const sql = postgres(process.env.DATABASE_URL || 'postgresql://invalid:invalid@localhost:5432/invalid', {
  max: 4, connect_timeout: 8, idle_timeout: 10, prepare: false, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : 'require',
});
