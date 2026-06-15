import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  email: { type: String, required: true },
  passwordHash: { type: String },
  provider: { type: String, default: "local" },
});

export const User = mongoose.models.User || mongoose.model("User", userSchema);
