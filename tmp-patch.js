const fs = require('fs');
const file = 'frontend/src/features/membership-packages/membership-packages-view.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the conditional block
const before = String.raw`{registeredVehicles && registeredVehicles.length > 0 ? (
                  <select
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                  >
                    {registeredVehicles.map((v: any) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} ({v.owner || "Chính chủ"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="VD: 30F-123.45"
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value.toUpperCase())}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                )}`;

const after = String.raw`{registeredVehicles && registeredVehicles.length > 0 ? (
                  <select
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                  >
                    {registeredVehicles.map((v: any) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate}{v.owner ? " — " + v.owner : ""}{v.status === "Cần duyệt" ? " (đang chờ duyệt)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: 14,
                    borderRadius: 8,
                    border: "1px dashed #fbbf24",
                    backgroundColor: "#fffbeb",
                    color: "#92400e",
                    fontSize: "0.88rem",
                    lineHeight: 1.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontSize: "1.2rem" }}>⚠️</div>
                      <div>
                        <strong>Bạn chưa đăng ký xe nào trong hệ thống.</strong>
                        <p style={{ margin: "6px 0 0 0" }}>
                          Vui lòng đăng ký xe tại mục{" "}
                          <a href="/dashboard/vehicles" onClick={() => setSelectedPkg(null)} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}>
                            Đăng ký xe & Phương tiện
                          </a>{" "}
                          trước khi mua gói cước.
                        </p>
                      </div>
                    </div>
                  </div>
                )}`;

if (!code.includes(before)) {
  console.log('BEFORE block not found — aborting');
  process.exit(1);
}
code = code.replace(before, after);

// Disable submit button when user has no vehicles
code = code.replace(
  'type="submit" className="button primary" disabled={subscribing} style={{ padding: "10px 20px" }}',
  'type="submit" className="button primary" disabled={subscribing || !(registeredVehicles && registeredVehicles.length > 0)} style={{ padding: "10px 20px" }}'
);

fs.writeFileSync(file, code);
console.log('OK - Updated');
