const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const res = await db.collection("parkingcameralogs").deleteMany({
    _id: { $in: ["6aad75fb4b886c2ff7327fc4"].map((id) => new ObjectId(id)) },
  });
  console.log("deleted:", res.deletedCount);
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
