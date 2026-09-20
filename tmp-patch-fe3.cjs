const fs = require("fs");
const file = "frontend/src/features/staff-desk/staff-desk-view.tsx";
let src = fs.readFileSync(file, "utf8");
const EOL = "\r\n";

const replacements = [
  [
    `    if (scanPhase === "starting" || scanPhase === "waiting") {${EOL}      return "Hãy đặt thẻ RFID của khách vào đầu đọc";${EOL}    }${EOL}`,
    `    if (scanPhase === "starting" || scanPhase === "waiting") {${EOL}      return expectedExitRfidUid${EOL}        ? \`Hãy đặt thẻ RFID \${expectedExitRfidUid} của khách vào đầu đọc\`${EOL}        : "Hãy đặt thẻ RFID của khách vào đầu đọc";${EOL}    }${EOL}`,
  ],
  [
    `    if (exitVerifyData?.canOpenGate) return "Thẻ hợp lệ — có thể mở barie";${EOL}    return "Hãy đặt thẻ RFID của khách vào đầu đọc";${EOL}  })();${EOL}`,
    `    if (exitVerifyData?.canOpenGate) return "Thẻ hợp lệ — có thể mở barie";${EOL}    return expectedExitRfidUid${EOL}      ? \`Hãy đặt thẻ RFID \${expectedExitRfidUid} của khách vào đầu đọc\`${EOL}      : "Hãy đặt thẻ RFID của khách vào đầu đọc";${EOL}  })();${EOL}`,
  ],
  [
    `  const replacementCardUid =${EOL}    typeof event.metadata?.replacementCardUid === "string"${EOL}      ? event.metadata.replacementCardUid${EOL}      : "";${EOL}`,
    `  const replacementCardUid =${EOL}    typeof event.metadata?.replacementCardUid === "string"${EOL}      ? event.metadata.replacementCardUid${EOL}      : "";${EOL}  // UID thẻ khách cần quẹt lúc ra: thẻ thay thế nếu đổi thẻ, ngược lại thẻ lúc vào.${EOL}  const expectedExitRfidUid = replacementCardUid || entryRfidUid || "";${EOL}`,
  ],
];

for (const [from, to] of replacements) {
  if (!src.includes(from)) {
    console.error("NOT FOUND:\n" + JSON.stringify(from));
    process.exit(1);
  }
  src = src.replace(from, to);
}
fs.writeFileSync(file, src);
console.log("patched OK");
