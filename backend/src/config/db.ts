import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  const uri = process.env.MONGODB_URI || env.mongoUri || "";
  if (!uri) {
    console.warn("MONGODB_URI not set — skipping DB connection in dev.");
    return;
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
