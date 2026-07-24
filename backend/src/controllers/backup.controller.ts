import { Request, Response } from "express";
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupStats,
} from "../services/backup.service.js";

export async function createBackupHandler(
  _request: Request,
  response: Response,
) {
  const backup = await createBackup();
  response.status(201).json({
    message: "Đã tạo bản sao lưu thành công.",
    backup,
  });
}

export async function listBackupsHandler(
  _request: Request,
  response: Response,
) {
  const backups = await listBackups();
  const stats = await getBackupStats();
  response.json({ backups, stats });
}

export async function restoreBackupHandler(
  request: Request,
  response: Response,
) {
  const filename = String(request.params.filename);

  const result = await restoreBackup(filename);
  response.json({
    message: `Đã khôi phục dữ liệu từ "${filename}" thành công.`,
    ...result,
  });
}

export async function deleteBackupHandler(
  request: Request,
  response: Response,
) {
  const filename = String(request.params.filename);

  await deleteBackup(filename);
  response.json({
    message: `Đã xóa bản sao lưu "${filename}" thành công.`,
    filename,
  });
}
