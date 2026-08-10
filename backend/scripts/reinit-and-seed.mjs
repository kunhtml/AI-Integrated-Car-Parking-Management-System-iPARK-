import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");

// Load .env manually so MONGODB_URI is available for both mongosh and seed.
try {
  const envFile = readFileSync(resolve(backendRoot, ".env"), "utf8");
  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip optional quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env optional
}

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/bai_do_xe";
const schemaPath = resolve(backendRoot, "src/scripts/clean_schema.js");

console.log("[Orchestrator] Target URI:", uri);
console.log("[Orchestrator] Reading schema from:", schemaPath);

let schemaSource = readFileSync(schemaPath, "utf8");
// Force drop & recreate so this script is idempotent for development.
if (!/const\s+DROP_AND_RECREATE\s*=/.test(schemaSource)) {
  console.error("[Orchestrator] ERROR: cannot locate DROP_AND_RECREATE flag in schema file.");
  process.exit(1);
}
schemaSource = schemaSource.replace(
  /const\s+DROP_AND_RECREATE\s*=\s*(true|false)\s*;/,
  "const DROP_AND_RECREATE = true;",
);

console.log("[Orchestrator] DROP_AND_RECREATE set to true. Schema will be rebuilt from scratch.");

// Try mongosh binary; fall back to Mongo Node driver if mongosh is unavailable.
let mongoshOk = false;
const { spawnSync } = await import("node:child_process");
const child = spawnSync("mongosh", [`"${uri}"`, "--quiet"], {
  input: schemaSource,
  shell: true,
  encoding: "utf8",
  stdio: ["pipe", "inherit", "inherit"],
});
if (child.status === 0) {
  mongoshOk = true;
  console.log("[Orchestrator] Schema applied via mongosh.");
} else {
  console.warn(
    "[Orchestrator] mongosh exited with code",
    child.status,
    "- falling back to Node driver.",
  );
}

if (!mongoshOk) {
  console.log("[Orchestrator] Applying schema via Mongo Node driver...");
  await applySchemaViaNodeDriver(uri);
}

console.log("[Orchestrator] Seeding data...");
await import("./seed.mjs");

console.log("[Orchestrator] Verifying collection counts...");
await verifyCollections(uri);

console.log("[Orchestrator] Done.");

async function applySchemaViaNodeDriver(uri) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      try { await db.collection(col.name).drop(); } catch {}
    }
    const collectionsToCreate = [
      ["users"], ["activesessions"], ["otptokens"],
      ["vehicles"], ["vehiclerequests"], ["zones"], ["parkingslots"],
      ["parkingsessions"], ["reservations"], ["subscriptionplans"],
      ["subscriptions"], ["transactions"], ["penaltyconfigs"],
      ["penalties"], ["pricingconfigs"], ["paymentconfigs"],
      ["devices"], ["devicemaintenancelogs"], ["incidents"],
      ["notifications"], ["notificationtemplates"],
      ["shiftschedules"], ["shifts"],
    ];
    for (const [name] of collectionsToCreate) {
      try { await db.createCollection(name); } catch {}
    }
    console.log("[Orchestrator] Collections dropped and recreated (validators not applied).");
    console.warn(
      "[Orchestrator] WARNING: $jsonSchema validators were NOT applied. Use mongosh for full schema with validators.",
    );
  } finally {
    await client.close();
  }
}

async function verifyCollections(uri) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const expected = [
      "users", "activesessions", "otptokens",
      "vehicles", "vehiclerequests", "zones", "parkingslots",
      "parkingsessions", "reservations", "subscriptionplans",
      "subscriptions", "transactions", "penaltyconfigs",
      "penalties", "pricingconfigs", "paymentconfigs",
      "devices", "devicemaintenancelogs", "incidents",
      "notifications", "notificationtemplates",
      "shiftschedules", "shifts",
    ];
    const actual = (await db.listCollections().toArray()).map((c) => c.name);
    console.log("[Orchestrator] Expected:", expected.length, "collections");
    console.log("[Orchestrator] Actual:  ", actual.length, "collections");
    for (const name of expected) {
      const present = actual.includes(name);
      const count = present ? await db.collection(name).countDocuments() : 0;
      console.log(`  ${present ? "OK" : "MISS"} ${name.padEnd(28)} ${count} docs`);
    }
    const extra = actual.filter((n) => !expected.includes(n));
    if (extra.length) {
      console.log("[Orchestrator] Extra collections:", extra);
    }
  } finally {
    await client.close();
  }
}
