const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const rows = await db.collection("parkingcameralogs").find({ direction: "in", plate: "30E92291", entryReviewState: "pending_review" }).sort({ createdAt: -1 }).toArray();
  console.log("PENDING:", rows.map(r => ({ id: String(r._id), createdAt: r.createdAt })));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
