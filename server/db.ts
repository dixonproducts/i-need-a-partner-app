import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import fs from "fs";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// DATABASE CONNECTION PRIORITY: DB_URL_OVERRIDE > /tmp/db-override > /tmp/replitdb > DATABASE_URL
let connectionString = process.env.DB_URL_OVERRIDE;
let connectionSource: 'env-override' | 'db-override' | 'replitdb' | 'env' = 'env';

if (connectionString) {
  connectionSource = 'env-override';
  console.log(`[DB] Using DB_URL_OVERRIDE environment variable`);
}

// Check for runtime database override file (allows production switching)
if (!connectionString) {
  try {
    if (fs.existsSync('/tmp/db-override')) {
      const overrideUrl = fs.readFileSync('/tmp/db-override', 'utf8').trim();
      if (overrideUrl) {
        connectionString = overrideUrl;
        connectionSource = 'db-override';
        console.log(`[DB] Using runtime database override from /tmp/db-override`);
      }
    }
  } catch (error) {
    console.log(`[DB] Could not read /tmp/db-override: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

// Check for Replit published app database URL location
if (!connectionString) {
  try {
    if (fs.existsSync('/tmp/replitdb')) {
      const replitDbUrl = fs.readFileSync('/tmp/replitdb', 'utf8').trim();
      if (replitDbUrl) {
        connectionString = replitDbUrl;
        connectionSource = 'replitdb';
        console.log(`[DB] Using Replit published app DATABASE_URL from /tmp/replitdb`);
      }
    }
  } catch (error) {
    console.log(`[DB] Could not read /tmp/replitdb: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

// Fall back to environment variable
if (!connectionString) {
  connectionString = process.env.DATABASE_URL;
  connectionSource = 'env';
}

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const host = connectionString.match(/@([^\/]+)/)?.[1] || 'unknown';
console.log(`[DB] Selected source: ${connectionSource}; host: ${host}`);

// RUNTIME DATABASE SWITCHING - allows production to switch databases without redeploy
export let pool = new Pool({ connectionString });
export let db = drizzle({ client: pool, schema });

export async function switchDatabase(newConnectionString: string): Promise<void> {
  console.log(`[DB] Switching to new database host: ${newConnectionString.match(/@([^/]+)/)?.[1] || 'unknown'}`);
  
  // Close existing pool
  await pool?.end();
  
  // Write override file for persistence across restarts
  try {
    fs.writeFileSync('/tmp/db-override', newConnectionString);
    console.log(`[DB] Wrote database override to /tmp/db-override`);
  } catch (error) {
    console.log(`[DB] Could not write /tmp/db-override: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  
  // Create new connections
  pool = new Pool({ connectionString: newConnectionString });
  db = drizzle({ client: pool, schema });
  
  console.log(`[DB] Database switch completed`);
}

export function getConnectionDiagnostics(): { source: string, host: string, maskedUrl: string } {
  let currentConnectionString = '';
  let currentSource = connectionSource;
  
  // Get current effective connection string
  if (fs.existsSync('/tmp/db-override')) {
    try {
      currentConnectionString = fs.readFileSync('/tmp/db-override', 'utf8').trim();
      currentSource = 'db-override';
    } catch (error) {
      console.log('Could not read db-override file');
    }
  } else if (process.env.DB_URL_OVERRIDE) {
    currentConnectionString = process.env.DB_URL_OVERRIDE;
    currentSource = 'env-override';
  } else if (fs.existsSync('/tmp/replitdb')) {
    try {
      currentConnectionString = fs.readFileSync('/tmp/replitdb', 'utf8').trim();
      currentSource = 'replitdb';
    } catch (error) {
      console.log('Could not read replitdb file');
    }
  } else {
    currentConnectionString = process.env.DATABASE_URL || '';
    currentSource = 'env';
  }
  
  const host = currentConnectionString.match(/@([^\/]+)/)?.[1] || 'unknown';
  const maskedUrl = currentConnectionString.replace(/:[^:@]*@/, ':****@');
  
  return { source: currentSource, host, maskedUrl };
}

export function getCurrentConnectionString(): string {
  const diagnostics = getConnectionDiagnostics();
  return diagnostics.maskedUrl;
}
