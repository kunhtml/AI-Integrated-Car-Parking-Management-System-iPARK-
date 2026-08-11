import multer from "multer";
import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục lưu ảnh xe đăng ký. Trỏ vào folder public của frontend để file
// được serve qua Next.js static (đường dẫn /uploads/vehicles/<file>).
// Có thể override qua env UPLOADS_VEHICLE_DIR.
const DEFAULT_DIR = path.resolve(__dirname, "../../uploads/vehicles");
const UPLOAD_DIR = process.env.UPLOADS_VEHICLE_DIR
  ? path.resolve(process.env.UPLOADS_VEHICLE_DIR)
  : DEFAULT_DIR;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    cb(null, `vehicle_${stamp}_${rand}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Chỉ chấp nhận file ảnh."));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRoutes = Router();

/**
 * POST /api/uploads/vehicle
 * FormData: { file: <binary> }
 * Trả về: { url: "/uploads/vehicles/vehicle_<ts>_<rand>.jpg" }
 *
 * File được lưu vào frontend/public/uploads/vehicles/ để Next.js serve static.
 */
uploadsRoutes.post(
  "/vehicle",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "Không có file được gửi." });
      return;
    }
    const url = `/uploads/vehicles/${req.file.filename}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }),
);

// Thư mục lưu ảnh minh chứng khiếu nại (UC15). Có thể override qua env UPLOADS_DISPUTE_DIR.
const DISPUTE_DIR = process.env.UPLOADS_DISPUTE_DIR
  ? path.resolve(process.env.UPLOADS_DISPUTE_DIR)
  : path.resolve(__dirname, "../../uploads/disputes");

if (!fs.existsSync(DISPUTE_DIR)) {
  fs.mkdirSync(DISPUTE_DIR, { recursive: true });
}

const disputeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DISPUTE_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
        ? ext
        : ".jpg";
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      cb(null, `dispute_${stamp}_${rand}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Chỉ chấp nhận file ảnh."));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/uploads/dispute
 * FormData: { file: <binary> }
 * Trả về: { url: "/uploads/disputes/dispute_<ts>_<rand>.jpg" }
 */
uploadsRoutes.post(
  "/dispute",
  requireAuth,
  disputeUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "Không có file được gửi." });
      return;
    }
    res.status(201).json({
      url: `/uploads/disputes/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }),
);
