import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvPython =
  process.platform === "win32"
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python");

if (!fs.existsSync(venvPython)) {
  console.error(`Python venv not found: ${venvPython}`);
  console.error("Create it first: python -m venv .venv");
  process.exit(1);
}

const child = spawn(venvPython, ["-m", "uvicorn", "main:app", "--reload", "--port", "5000"], {
  cwd: path.join(root, "ai-service"),
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
