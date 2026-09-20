const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const subs = await db.collection("subscriptions").find({ primaryVehicleId: new ObjectId("6aa974bdf81147eb16c201c6") }).toArray();
  console.log("SUBS:", JSON.stringify(subs.map(s => ({ status: s.status, planName: s.planName, endDate: s.endDate })), null, 2));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
