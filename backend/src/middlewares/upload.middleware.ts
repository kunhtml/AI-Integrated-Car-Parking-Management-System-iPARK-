import multer from "multer";

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter(_request, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Chỉ được upload file ảnh."));
      return;
    }

    callback(null, true);
  },
});
