const fs = require("fs");
const file = "backend/src/controllers/camera-bridge.controller.ts";
let src = fs.readFileSync(file, "utf8");
const EOL = "\r\n";

const replacements = [
  [
    `  const memberCardForPlate = activeMemberSubscription${EOL}    ? await RfidCard.findOne({${EOL}        plate,${EOL}        cardType: "member",${EOL}        status: { $in: ["active", "in-use"] },${EOL}      }).select("uid")${EOL}    : null;${EOL}`,
    `  // Thẻ Member khách đã mua đứt cho biển số — tra cả khi gói dịch vụ đã hết${EOL}  // hạn: bàn nhân viên cần hiện UID thẻ khách đang giữ để đối chiếu thẻ vật lý.${EOL}  const memberCardForPlate = activeMemberSubscription${EOL}    ? await RfidCard.findOne({${EOL}        plate,${EOL}        cardType: "member",${EOL}        status: { $in: ["active", "in-use"] },${EOL}      })${EOL}      .sort({ soldAt: -1, updatedAt: -1 })${EOL}      .select("uid")${EOL}      .lean()${EOL}    : null;${EOL}  const purchasedCardForPlate =${EOL}    !memberCardForPlate && plate${EOL}      ? await RfidCard.findOne({${EOL}          plate,${EOL}          cardType: "member",${EOL}          status: { $in: ["active", "in-use"] },${EOL}        })${EOL}        .sort({ soldAt: -1, updatedAt: -1 })${EOL}        .select("uid")${EOL}        .lean()${EOL}      : null;${EOL}`,
  ],
  [
    `  const expectedRfidUid =${EOL}    openSession?.expectedExitRfidUid || memberCardForPlate?.uid || null;${EOL}`,
    `  const expectedRfidUid =${EOL}    openSession?.expectedExitRfidUid || memberCardForPlate?.uid || null;${EOL}  // UID thẻ Member khách đã mua đứt (kể cả khi gói đăng ký đã hết hạn) —${EOL}  // frontend dùng để hiện thẻ khách đang giữ trên bàn nhân viên.${EOL}  const purchasedCardUid =${EOL}    memberCardForPlate?.uid || purchasedCardForPlate?.uid || null;${EOL}`,
  ],
  [
    `    vehicleType: (vehicle as any)?.type || vehicle?.vehicleType || null,${EOL}`,
    `    vehicleType: (vehicle as any)?.type || vehicle?.vehicleType || null,${EOL}    purchasedCardUid,${EOL}`,
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
