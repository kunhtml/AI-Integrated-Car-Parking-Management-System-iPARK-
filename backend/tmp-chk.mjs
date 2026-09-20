import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const s = await db.collection("parkingsessions").findOne({ _id: new mongoose.Types.ObjectId("6aad5cdb225a356f45dc3955") });
console.log(JSON.stringify({ plate: s.plate, status: s.status, paymentStatus: s.paymentStatus, paymentMethod: s.paymentMethod, fee: s.fee, exitState: s.exitState, customerType: s.customerType, exitDetectedAt: s.exitDetectedAt }, null, 2));
await mongoose.disconnect();
