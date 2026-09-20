const fs = require("fs");
const file = "frontend/src/app/globals.css";
let src = fs.readFileSync(file, "utf8");
const EOL = src.includes("\r\n") ? "\r\n" : "\n";

const from = `.staff-desk__ingest-manual-title {${EOL}  margin: 0;${EOL}  font-size: 0.9rem;${EOL}  font-weight: 600;${EOL}  color: #334155;${EOL}}${EOL}`;
const to = `.staff-desk__ingest-manual-title {${EOL}  margin: 0;${EOL}  font-size: 0.9rem;${EOL}  font-weight: 600;${EOL}  color: #334155;${EOL}}${EOL}${EOL}.staff-desk__ingest-manual-title .staff-desk__ingest-uid {${EOL}  margin: 0 4px;${EOL}  padding: 1px 7px;${EOL}  border-radius: 6px;${EOL}  background: rgba(47, 111, 176, 0.12);${EOL}  color: #1d4ed8;${EOL}  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;${EOL}  font-size: 0.95rem;${EOL}  font-weight: 700;${EOL}  letter-spacing: 0.08em;${EOL}}${EOL}`;

if (!src.includes(from)) {
  console.error("NOT FOUND");
  process.exit(1);
}
src = src.replace(from, to);
fs.writeFileSync(file, src);
console.log("patched OK");
