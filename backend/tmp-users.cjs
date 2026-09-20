const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const users = await db.collection("users").find({ role: { $in: ["staff", "admin"] } }).project({ name: 1, email: 1, role: 1 }).limit(5).toArray();
  console.log(JSON.stringify(users, null, 2));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
