const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const c = new MongoClient("mongodb://localhost:27017/bai-do-xe");
  await c.connect();
  const db = c.db("bai-do-xe");
  const log = await db.collection("parkingcameralogs").findOne({ _id: new ObjectId("6aad750d4b886c2ff7327fc2") });
  console.log(JSON.stringify(Object.keys(log), null, 2));
  console.log("meta:", JSON.stringify(log.metadata));
  console.log("entryReviewState:", log.entryReviewState, "action:", log.action);
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
