import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function saveUploadedImage(file: Express.Multer.File, folder: "entry" | "exit" | "violation") {
  const ext = path.extname(file.originalname || ".jpg") || ".jpg";
  const fileName = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), file.buffer);
  return `/uploads/${folder}/${fileName}`;
}
