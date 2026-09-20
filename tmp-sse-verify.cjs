const http = require("http");
const fs = require("fs");

const cookieLine = fs.readFileSync("tmp-cookies.txt", "utf8")
  .split(/\r?\n/)
  .find((l) => l.includes("parking_session"));
const cookieHeader = cookieLine
  ? cookieLine.trim().split(/\s+/).slice(-2).join("=")
  : "";
console.log("COOKIE len:", cookieHeader.length);

const req = http.request(
  {
    host: "localhost",
    port: 4000,
    path: "/api/camera-logs/stream",
    method: "GET",
    headers: { Accept: "text/event-stream", Cookie: cookieHeader },
  },
  (res) => {
    console.log("SSE status:", res.statusCode);
    let buffer = "";
    res.on("data", (chunk) => {
      buffer += chunk.toString();
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = block.split("\n");
        let evt = "message";
        const data = [];
        for (const l of lines) {
          if (l.startsWith("event:")) evt = l.slice(6).trim();
          if (l.startsWith("data:")) data.push(l.slice(5).trim());
        }
        if (evt === "camera.ingest") {
          try {
            const ev = JSON.parse(data.join("\n"));
            console.log("INGEST plate:", ev.plate);
            console.log("metadata:", JSON.stringify(ev.metadata, null, 2));
          } catch (e) {
            console.log("parse err", e.message);
          }
          clearTimeout(killTimer);
          res.destroy();
          process.exit(0);
        }
      }
    });
  },
);
req.on("error", (e) => { console.error("ERR", e.message); process.exit(1); });
req.end();

setTimeout(() => {
  const body = JSON.stringify({ direction: "in", detectedPlate: "30E92291", confidence: 0.95, userType: "resident" });
  const post = http.request(
    {
      host: "localhost",
      port: 4000,
      path: "/api/bridge/log",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Service-Token": "ipark-bridge-token-2026-change-me-in-production",
      },
    },
    (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => console.log("POST status:", r.statusCode));
    },
  );
  post.on("error", (e) => console.error("POST ERR", e.message));
  post.end(body);
}, 1500);

const killTimer = setTimeout(() => {
  console.error("TIMEOUT — no ingest event received");
  process.exit(2);
}, 12000);
