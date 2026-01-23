/**
 * SQLite Database Migration System
 *
 * This module provides a migration system for managing database schema changes.
 * Each migration has a version number, name, and up/down SQL statements.
 */

import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES, CREATE_INDEXES, SCHEMA_VERSION } from './schema';

// ============================================
// Types
// ============================================

/**
 * Migration definition
 */
export interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  appliedMigrations: number[];
  error?: string;
}

// ============================================
// Migration Definitions
// ============================================

/**
 * Initial migration that creates all base tables
 */
const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: [
    // Create tables in order (respecting foreign key dependencies)
    CREATE_TABLES.schema_migrations,
    CREATE_TABLES.cached_stands,
    CREATE_TABLES.cached_wallets,
    CREATE_TABLES.cached_products,
    CREATE_TABLES.cached_transactions,
    CREATE_TABLES.pending_transactions,
    CREATE_TABLES.sync_queue,
    // Create indexes
    ...CREATE_INDEXES,
  ],
  down: [
    // Drop tables in reverse order
    'DROP TABLE IF EXISTS sync_queue;',
    'DROP TABLE IF EXISTS pending_transactions;',
    'DROP TABLE IF EXISTS cached_transactions;',
    'DROP TABLE IF EXISTS cached_products;',
    'DROP TABLE IF EXISTS cached_wallets;',
    'DROP TABLE IF EXISTS cached_stands;',
    'DROP TABLE IF EXISTS schema_migrations;',
  ],
};

/**
 * List of all migrations in order
 * Add new migrations here as the schema evolves
 */
export const MIGRATIONS: Migration[] = [
  migration001,
  // Future migrations will be added here:
  // migration002,
  // migration003,
];

// ============================================
// Migration Runner
// ============================================

/**
 * Gets the current schema version from the database
 */
export async function getCurrentVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  try {
    // First check if schema_migrations table exists
    const tableCheck = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations';`
    );

    if (!tableCheck) {
      return 0; // No migrations applied yet
    }

    // Get the highest version number
    const result = await db.getFirstAsync<{ max_version: number | null }>(
      `SELECT MAX(version) as max_version FROM schema_migrations;`
    );

    return result?.max_version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Records a migration as applied
 */
async function recordMigration(
  db: SQLite.SQLiteDatabase,
  version: number,
  name: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);`,
    [version, name, new Date().toISOString()]
  );
}

/**
 * Removes a migration record
 */
async function removeMigrationRecord(
  db: SQLite.SQLiteDatabase,
  version: number
): Promise<void> {
  await db.runAsync(
    `DELETE FROM schema_migrations WHERE version = ?;`,
    [version]
  );
}

/**
 * Applies a single migration
 */
async function applyMigration(
  db: SQLite.SQLiteDatabase,
  migration: Migration
): Promise<void> {
  console.log(`[Migration] Applying migration ${migration.version}: ${migration.name}`);

  try {
    // Execute each SQL statement in the migration
    for (const sql of migration.up) {
      await db.execAsync(sql);
    }

    // Record the migration (skip for the initial migration that creates the table)
    if (migration.version > 0) {
      await recordMigration(db, migration.version, migration.name);
    }

    console.log(`[Migration] Successfully applied migration ${migration.version}`);
  } catch (error) {
    console.error(`[Migration] Failed to apply migration ${migration.version}:`, error);
    throw error;
  }
}

/**
 * Rolls back a single migration
 */
async function rollbackMigration(
  db: SQLite.SQLiteDatabase,
  migration: Migration
): Promise<void> {
  console.log(`[Migration] Rolling back migration ${migration.version}: ${migration.name}`);

  try {
    // Execute each down SQL statement
    for (const sql of migration.down) {
      await db.execAsync(sql);
    }

    // Remove the migration record
    await removeMigrationRecord(db, migration.version);

    console.log(`[Migration] Successfully rolled back migration ${migration.version}`);
  } catch (error) {
    console.error(`[Migration] Failed to rollback migration ${migration.version}:`, error);
    throw error;
  }
}

/**
 * Runs all pending migrations
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<MigrationResult> {
  const appliedMigrations: number[] = [];

  try {
    // Get current version
    const currentVersion = await getCurrentVersion(db);
    console.log(`[Migration] Current schema version: ${currentVersion}`);
    console.log(`[Migration] Target schema version: ${SCHEMA_VERSION}`);

    if (currentVersion >= SCHEMA_VERSION) {
      console.log('[Migration] Database is up to date');
      return { success: true, appliedMigrations: [] };
    }

    // Find and apply pending migrations
    const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);
    console.log(`[Migration] Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await applyMigration(db, migration);
      appliedMigrations.push(migration.version);

      // For the first migration, we need to record it after the table is created
      if (migration.version === 1) {
        await recordMigration(db, migration.version, migration.name);
      }
    }

    console.log('[Migration] All migrations completed successfully');
    return { success: true, appliedMigrations };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Migration] Migration failed:', errorMessage);

    return {
      success: false,
      appliedMigrations,
      error: errorMessage,
    };
  }
}

/**
 * Rolls back to a specific version
 */
export async function rollbackToVersion(
  db: SQLite.SQLiteDatabase,
  targetVersion: number
): Promise<MigrationResult> {
  const rolledBackMigrations: number[] = [];

  try {
    const currentVersion = await getCurrentVersion(db);
    console.log(`[Migration] Current version: ${currentVersion}, target: ${targetVersion}`);

    if (currentVersion <= targetVersion) {
      console.log('[Migration] Nothing to rollback');
      return { success: true, appliedMigrations: [] };
    }

    // Find migrations to rollback (in reverse order)
    const migrationsToRollback = MIGRATIONS.filter(
      (m) => m.version > targetVersion && m.version <= currentVersion
    ).reverse();

    for (const migration of migrationsToRollback) {
      await rollbackMigration(db, migration);
      rolledBackMigrations.push(migration.version);
    }

    console.log('[Migration] Rollback completed successfully');
    return { success: true, appliedMigrations: rolledBackMigrations };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Migration] Rollback failed:', errorMessage);

    return {
      success: false,
      appliedMigrations: rolledBackMigrations,
      error: errorMessage,
    };
  }
}

/**
 * Resets the database by dropping all tables and re-running migrations
 */
export async function resetDatabase(db: SQLite.SQLiteDatabase): Promise<MigrationResult> {
  console.log('[Migration] Resetting database...');

  try {
    // Rollback all migrations
    await rollbackToVersion(db, 0);

    // Run all migrations again
    return await runMigrations(db);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Migration] Reset failed:', errorMessage);

    return {
      success: false,
      appliedMigrations: [],
      error: errorMessage,
    };
  }
}

/**
 * Checks if the database needs migration
 */
export async function needsMigration(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const currentVersion = await getCurrentVersion(db);
  return currentVersion < SCHEMA_VERSION;
}

/**
 * Gets list of applied migrations
 */
export async function getAppliedMigrations(
  db: SQLite.SQLiteDatabase
): Promise<Array<{ version: number; name: string; appliedAt: string }>> {
  try {
    const tableCheck = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations';`
    );

    if (!tableCheck) {
      return [];
    }

    const rows = await db.getAllAsync<{
      version: number;
      name: string;
      applied_at: string;
    }>(`SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;`);

    return rows.map((row) => ({
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Gets pending migrations that haven't been applied
 */
export async function getPendingMigrations(
  db: SQLite.SQLiteDatabase
): Promise<Migration[]> {
  const currentVersion = await getCurrentVersion(db);
  return MIGRATIONS.filter((m) => m.version > currentVersion);
}
