import { env } from "../config/env.js";

export type AiDetectionResult = {
  plate: string;
  confidence: number;
  rawText: string;
  vehicleType: string;
  imageHash: string;
  detectionMethod?: string;
};

export async function detectVehicleImage(file: Express.Multer.File): Promise<AiDetectionResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
  form.append("file", blob, file.originalname);

  const response = await fetch(`${env.aiServiceUrl}/detect`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error("AI service detection failed");
  }

  return response.json() as Promise<AiDetectionResult>;
}

export type SlotPolygon = {
  slotCode: string;
  polygon: [number, number][];
};

export type DetectedCar = {
  box: [number, number, number, number]; // x1,y1,x2,y2 chuẩn hoá 0..1
  conf: number;
};

export type DetectCarsResult = {
  vehicleCount: number;
  cars: DetectedCar[];
};

export async function detectCarsImage(
  file: Express.Multer.File,
  options: {
    conf?: number;
    imgsz?: number;
    model?: string;
    classAgnostic?: boolean;
    minAreaFrac?: number;
    maxAreaFrac?: number;
  } = {},
): Promise<DetectCarsResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
  form.append("file", blob, file.originalname);
  if (options.conf != null) form.append("conf", String(options.conf));
  if (options.imgsz != null) form.append("imgsz", String(options.imgsz));
  if (options.model != null) form.append("model", options.model);
  if (options.classAgnostic != null) form.append("classAgnostic", String(options.classAgnostic));
  if (options.minAreaFrac != null) form.append("minAreaFrac", String(options.minAreaFrac));
  if (options.maxAreaFrac != null) form.append("maxAreaFrac", String(options.maxAreaFrac));

  const response = await fetch(`${env.aiServiceUrl}/detect-cars`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "AI car detection failed");
  }

  return response.json() as Promise<DetectCarsResult>;
}

export type SlotOccupancy = {
  slotCode: string;
  status: "empty" | "occupied" | "straddling" | "intruded";
  coverage: number;
  straddling: string[];
};

export type OccupancyResult = {
  vehicleCount: number;
  slots: SlotOccupancy[];
  violations: SlotOccupancy[];
};

export async function detectOccupancyImage(
  file: Express.Multer.File,
  slots: SlotPolygon[],
  options: {
    overlapThreshold?: number;
    straddleThreshold?: number;
    conf?: number;
    imgsz?: number;
    model?: string;
    classAgnostic?: boolean;
    minAreaFrac?: number;
    maxAreaFrac?: number;
  } = {},
): Promise<OccupancyResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
  form.append("file", blob, file.originalname);
  form.append("slots", JSON.stringify(slots));
  if (options.overlapThreshold != null) form.append("overlapThreshold", String(options.overlapThreshold));
  if (options.straddleThreshold != null) form.append("straddleThreshold", String(options.straddleThreshold));
  if (options.conf != null) form.append("conf", String(options.conf));
  if (options.imgsz != null) form.append("imgsz", String(options.imgsz));
  if (options.model != null) form.append("model", options.model);
  if (options.classAgnostic != null) form.append("classAgnostic", String(options.classAgnostic));
  if (options.minAreaFrac != null) form.append("minAreaFrac", String(options.minAreaFrac));
  if (options.maxAreaFrac != null) form.append("maxAreaFrac", String(options.maxAreaFrac));

  const response = await fetch(`${env.aiServiceUrl}/detect-occupancy`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "AI occupancy detection failed");
  }

  return response.json() as Promise<OccupancyResult>;
}

export type LaneDivider = {
  start: [number, number];
  end: [number, number];
};

export type StraddleCar = {
  box: [number, number, number, number];
  conf: number;
  straddling: boolean;
  dividerIndices: number[];
};

export type StraddleResult = {
  vehicleCount: number;
  straddleCount: number;
  cars: StraddleCar[];
  dividerCount: number;
};

export async function detectStraddleImage(
  file: Express.Multer.File,
  dividers: LaneDivider[],
  options: {
    conf?: number;
    imgsz?: number;
    edgeRatio?: number;
    model?: string;
    classAgnostic?: boolean;
    minAreaFrac?: number;
    maxAreaFrac?: number;
  } = {},
): Promise<StraddleResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
  form.append("file", blob, file.originalname);
  form.append("dividers", JSON.stringify(dividers));
  if (options.conf != null) form.append("conf", String(options.conf));
  if (options.imgsz != null) form.append("imgsz", String(options.imgsz));
  if (options.edgeRatio != null) form.append("edgeRatio", String(options.edgeRatio));
  if (options.model != null) form.append("model", options.model);
  if (options.classAgnostic != null) form.append("classAgnostic", String(options.classAgnostic));
  if (options.minAreaFrac != null) form.append("minAreaFrac", String(options.minAreaFrac));
  if (options.maxAreaFrac != null) form.append("maxAreaFrac", String(options.maxAreaFrac));

  const response = await fetch(`${env.aiServiceUrl}/detect-straddle`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "AI straddle detection failed");
  }

  return response.json() as Promise<StraddleResult>;
}

export type SuggestDividersResult = {
  lineCount: number;
  dividers: LaneDivider[];
};

export async function suggestDividersImage(
  file: Express.Multer.File,
  options: { minCluster?: number } = {},
): Promise<SuggestDividersResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
  form.append("file", blob, file.originalname);
  if (options.minCluster != null) form.append("minCluster", String(options.minCluster));

  const response = await fetch(`${env.aiServiceUrl}/suggest-dividers`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "AI suggest dividers failed");
  }

  return response.json() as Promise<SuggestDividersResult>;
}
