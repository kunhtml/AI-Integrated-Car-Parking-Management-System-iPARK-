import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function createBackup() {
  await ensureBackupDir();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database not connected.");
  }

  const collections = await db.listCollections().toArray();
  const backupData: Record<string, unknown[]> = {};
  let documentCount = 0;

  for (const col of collections) {
    const collectionName = col.name;
    const documents = await db.collection(collectionName).find({}).toArray();
    backupData[collectionName] = documents;
    documentCount += documents.length;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);
  const jsonContent = JSON.stringify(backupData, null, 2);

  await fs.writeFile(filePath, jsonContent, "utf-8");
  const stats = await fs.stat(filePath);

  return {
    filename,
    path: filePath,
    size: stats.size,
    collections: Object.keys(backupData),
    documentCount,
  };
}

export async function listBackups() {
  await ensureBackupDir();

  const files = await fs.readdir(BACKUP_DIR);
  const backupFiles = files.filter((f) => f.endsWith(".json"));

  const backups = await Promise.all(
    backupFiles.map(async (filename) => {
      const filePath = path.join(BACKUP_DIR, filename);
      const stats = await fs.stat(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    }),
  );

  backups.sort(
    (a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime(),
  );

  return backups;
}

export async function restoreBackup(filename: string) {
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Backup file "${filename}" not found.`);
  }

  const content = await fs.readFile(filePath, "utf-8");
  const backupData: Record<string, unknown[]> = JSON.parse(content);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database not connected.");
  }

  let restored = 0;
  const restoredCollections: string[] = [];

  for (const [collectionName, documents] of Object.entries(backupData)) {
    if (!Array.isArray(documents)) continue;

    const collection = db.collection(collectionName);
    await collection.drop().catch(() => {
      // Collection may not exist yet, ignore error
    });

    if (documents.length > 0) {
      await collection.insertMany(documents as any[]);
      restored += documents.length;
    }

    restoredCollections.push(collectionName);
  }

  return {
    restored,
    collections: restoredCollections,
  };
}

export async function deleteBackup(filename: string) {
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Backup file "${filename}" not found.`);
  }

  await fs.unlink(filePath);
}

export async function getBackupStats() {
  const backups = await listBackups();

  const totalBackups = backups.length;
  const lastBackupAt =
    backups.length > 0 ? backups[0].modifiedAt : null;
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return {
    totalBackups,
    lastBackupAt,
    totalSize,
  };
}
