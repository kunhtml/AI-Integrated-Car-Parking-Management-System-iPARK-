import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function detectVehicleImage(image: Express.Multer.File) {
  const plateMatch = image.originalname.match(/([0-9]{2}[A-Z]-?[0-9]{3,5})/i);
  const plate = plateMatch?.[1]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";

  return {
    plate: plate.length >= 5 ? plate : "",
    confidence: plate ? 0.72 : 0,
    imageHash: hashBuffer(image.buffer),
    rawText: plate || "Không nhận diện được biển số",
  };
}

export async function saveUploadedImage(image: Express.Multer.File, folder: string) {
  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${image.originalname.replace(/[^\w.-]+/g, "_")}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, image.buffer);
  return `/uploads/${folder}/${fileName}`;
}
