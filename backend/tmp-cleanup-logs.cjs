const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const ids = ["6aad752796d23624c9e355f8", "6aad750d4b886c2ff7327fc2"];
  const res = await db.collection("parkingcameralogs").deleteMany({
    _id: { $in: ids.map((id) => new ObjectId(id)) },
  });
  console.log("deleted test logs:", res.deletedCount);
  const left = await db.collection("parkingcameralogs").countDocuments({ direction: "in", plate: "30E92291", entryReviewState: "pending_review" });
  console.log("remaining pending for plate:", left);
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
