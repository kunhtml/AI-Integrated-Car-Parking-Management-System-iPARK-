const fs = require("fs");
const file = "frontend/src/features/staff-desk/staff-desk-view.tsx";
let src = fs.readFileSync(file, "utf8");
const EOL = "\r\n";

const from = `                <p className="staff-desk__ingest-manual-title">${EOL}                  {aiPlateMissing${EOL}                    ? "Nhập biển số xe thủ công"${EOL}                    : plateStep === "confirmed"${EOL}                      ? linkedRfidUid${EOL}                        ? "Biển số " +${EOL}                          props.reviewPlate +${EOL}                          " — quẹt thẻ RFID "${EOL}                      : "Đối chiếu biển số AI nhận diện"}${EOL}                </p>${EOL}`;

const to = `                <p className="staff-desk__ingest-manual-title">${EOL}                  {aiPlateMissing${EOL}                    ? "Nhập biển số xe thủ công"${EOL}                    : plateStep === "confirmed"${EOL}                      ? linkedRfidUid${EOL}                        ? <>${EOL}                            Biển số {props.reviewPlate} — quẹt thẻ RFID${EOL}                            <code className="staff-desk__ingest-uid">${EOL}                              {linkedRfidUid}${EOL}                            </code>${EOL}                            của khách vào đầu đọc${EOL}                          </>${EOL}                        : \`Biển số \${props.reviewPlate} — quẹt thẻ RFID của khách vào đầu đọc\`${EOL}                      : "Đối chiếu biển số AI nhận diện"}${EOL}                </p>${EOL}`;

if (!src.includes(from)) {
  console.error("NOT FOUND");
  process.exit(1);
}
src = src.replace(from, to);
fs.writeFileSync(file, src);
console.log("patched OK");
