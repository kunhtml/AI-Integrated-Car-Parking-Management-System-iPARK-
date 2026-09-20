const fs = require("fs");
const file = "frontend/src/features/staff-desk/staff-desk-view.tsx";
let src = fs.readFileSync(file, "utf8");
const EOL = "\r\n";

const replacements = [
  // 1) IngestCard: đọc purchasedCardUid (thẻ Member khách đã mua đứt).
  [
    `  const expectedRfidUid =${EOL}    typeof event.metadata?.expectedRfidUid === "string"${EOL}      ? event.metadata.expectedRfidUid${EOL}      : "";${EOL}`,
    `  const expectedRfidUid =${EOL}    typeof event.metadata?.expectedRfidUid === "string"${EOL}      ? event.metadata.expectedRfidUid${EOL}      : "";${EOL}  // Thẻ Member khách đã mua đứt cho biển số này (kể cả khi gói đăng ký đã${EOL}  // hết hạn) — hiện UID để nhân viên đối chiếu thẻ vật lý của khách.${EOL}  const purchasedCardUid =${EOL}    typeof event.metadata?.purchasedCardUid === "string"${EOL}      ? event.metadata.purchasedCardUid${EOL}      : "";${EOL}  const linkedRfidUid = purchasedCardUid || expectedRfidUid;${EOL}`,
  ],
  // 2) MetaRow "Thẻ RFID gắn với biển số" hiện UID thẻ khách đã mua.
  [
    `          label="Thẻ RFID gắn với biển số"${EOL}          value={expectedRfidUid || "RFID không gắn sẵn"}${EOL}`,
    `          label="Thẻ RFID gắn với biển số"${EOL}          value={linkedRfidUid || "RFID không gắn sẵn"}${EOL}`,
  ],
  // 3) Tiêu đề nhắc quét thẻ hiện luôn UID thẻ của khách.
  [
    `                <p className="staff-desk__ingest-manual-title">${EOL}                  {aiPlateMissing${EOL}                    ? "Nhập biển số xe thủ công"${EOL}                    : plateStep === "confirmed"${EOL}                      ? \`Biển số \${props.reviewPlate} — quẹt thẻ RFID của khách vào đầu đọc\`${EOL}                      : "Đối chiếu biển số AI nhận diện"}${EOL}                </p>${EOL}`,
    `                <p className="staff-desk__ingest-manual-title">${EOL}                  {aiPlateMissing${EOL}                    ? "Nhập biển số xe thủ công"${EOL}                    : plateStep === "confirmed"${EOL}                      ? linkedRfidUid${EOL}                        ? "Biển số " +${EOL}                          props.reviewPlate +${EOL}                          " — quẹt thẻ RFID "${EOL}                      : "Đối chiếu biển số AI nhận diện"}${EOL}                </p>${EOL}`,
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
