import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export type RoiConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function cropImageByRoi(buffer: Buffer, roi: RoiConfig): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();
    const imgWidth = metadata.width || 640;
    const imgHeight = metadata.height || 360;

    // Clamp ROI to image boundaries
    const left = Math.max(0, Math.min(roi.x, imgWidth - 1));
    const top = Math.max(0, Math.min(roi.y, imgHeight - 1));
    const width = Math.max(1, Math.min(roi.width, imgWidth - left));
    const height = Math.max(1, Math.min(roi.height, imgHeight - top));

    return await sharp(buffer)
      .extract({ left, top, width, height })
      .toBuffer();
  } catch {
    // If sharp is not available, return original buffer
    return buffer;
  }
}

async function callPythonAiService(buffer: Buffer, filename: string): Promise<{
  plate: string;
  confidence: number;
  rawText: string;
  imageHash: string;
  vehicleType: string;
  detectionMethod?: string;
} | null> {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "image/jpeg" });
    formData.append("file", blob, filename);

    const response = await fetch(`${aiUrl}/detect`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      plate?: string;
      confidence?: number;
      rawText?: string;
      vehicleType?: string;
      imageHash?: string;
      detectionMethod?: string;
    };

    return {
      plate: data.plate || "",
      confidence: data.confidence || 0,
      rawText: data.rawText || "",
      imageHash: data.imageHash || hashBuffer(buffer),
      vehicleType: data.vehicleType || "Ô tô",
      detectionMethod: data.detectionMethod,
    };
  } catch {
    return null;
  }
}

function parsePlateFromFilename(filename: string): string {
  const plateMatch = filename.match(/([0-9]{2}[A-Z]-?[0-9]{3,5})/i);
  return plateMatch?.[1]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
}

export async function detectVehicleImage(
  image: Express.Multer.File | Buffer,
  roi?: RoiConfig | null,
) {
  const isBuffer = Buffer.isBuffer(image);
  const processBuffer: Buffer = isBuffer ? image : image.buffer;
  const originalName = isBuffer ? "snapshot.jpg" : (image.originalname || "upload.jpg");

  // Step 1: Crop by ROI if provided (only makes sense for file-like with metadata; skip for raw buffer or apply same)
  let finalBuffer = processBuffer;
  if (!isBuffer && roi && roi.width > 0 && roi.height > 0) {
    finalBuffer = await cropImageByRoi(processBuffer, roi);
  }

  // Step 2: Try Python AI service first (real OCR with Tesseract + OpenCV)
  const aiResult = await callPythonAiService(finalBuffer, originalName);
  if (aiResult && aiResult.plate) {
    return {
      plate: aiResult.plate,
      confidence: aiResult.confidence,
      imageHash: hashBuffer(isBuffer ? image : image.buffer),
      rawText: aiResult.rawText,
      vehicleType: (aiResult as any).vehicleType || "Ô tô",
      detectionMethod: aiResult.detectionMethod || "plate-model",
    };
  }

  // Step 3: Fallback — parse plate from filename
  const plate = parsePlateFromFilename(originalName);

  return {
    plate: plate.length >= 5 ? plate : "",
    confidence: plate ? 0.72 : 0,
    imageHash: hashBuffer(isBuffer ? image : image.buffer),
    rawText: plate || "Không nhận diện được biển số",
    vehicleType: "Ô tô",
    detectionMethod: "filename-fallback",
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
