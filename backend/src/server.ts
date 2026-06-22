import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

await connectDb();

app.listen(env.port, () => {
  console.log(`iPARK backend listening on http://localhost:${env.port}`);
});
