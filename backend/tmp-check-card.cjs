const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const cards = await db.collection("rfidcards").find({ plate: /30E92291/ }).toArray();
  console.log("CARDS:", JSON.stringify(cards, null, 2));
  const vehicles = await db.collection("vehicles").find({ plate: /30E92291/ }).toArray();
  console.log("VEHICLES:", JSON.stringify(vehicles.map(v => ({ _id: String(v._id), plate: v.plate, ownerName: v.ownerName, userId: String(v.userId) })), null, 2));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
