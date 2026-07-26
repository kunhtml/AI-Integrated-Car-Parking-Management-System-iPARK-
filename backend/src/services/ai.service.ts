import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type VehicleDetection = {
  plate: string;
  confidence: number;
  imageHash: string;
  rawText: string;
  vehicleType?: string;
};

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizePlate(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function fallbackDetect(image: Express.Multer.File): VehicleDetection {
  const plateMatch = image.originalname.match(/([0-9]{2}[A-Z]-?[0-9]{3,5})/i);
  const plate = normalizePlate(plateMatch?.[1] || "");
  return {
    plate: plate.length >= 5 ? plate : "",
    confidence: plate ? 72 : 0,
    imageHash: hashBuffer(image.buffer),
    rawText: plate || "Không nhận diện được biển số",
    vehicleType: "Ô tô",
  };
}

export async function detectVehicleImage(image: Express.Multer.File): Promise<VehicleDetection> {
  const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";

  try {
    const form = new FormData();
    const blob = new Blob([image.buffer], { type: image.mimetype || "image/jpeg" });
    form.append("file", blob, image.originalname || "vehicle.jpg");

    const response = await fetch(`${aiUrl.replace(/\/$/, "")}/detect`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      return fallbackDetect(image);
    }

    const data = await response.json();
    const plate = normalizePlate(data.plate || "");
    return {
      plate,
      confidence: Number(data.confidence || 0),
      imageHash: data.imageHash || hashBuffer(image.buffer),
      rawText: data.rawText || plate,
      vehicleType: data.vehicleType || "Ô tô",
    };
  } catch {
    return fallbackDetect(image);
  }
}

export async function saveUploadedImage(image: Express.Multer.File, folder: string) {
  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${image.originalname.replace(/[^\w.-]+/g, "_")}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, image.buffer);
  return `/uploads/${folder}/${fileName}`;
}
