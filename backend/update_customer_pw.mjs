import bcrypt from "bcryptjs";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect("mongodb://localhost:27017/bai-do-xe");
  const hash = await bcrypt.hash("123456", 10);
  
  await mongoose.connection.db.collection("users").updateOne(
    { email: "kh.1@ipark.vn" },
    { $set: { password: hash, role: "customer", fullName: "Khách hàng iPARK", phone: "0909888999" } },
    { upsert: true }
  );
  console.log("Customer accounts updated successfully!");
  await mongoose.disconnect();
}
main();
