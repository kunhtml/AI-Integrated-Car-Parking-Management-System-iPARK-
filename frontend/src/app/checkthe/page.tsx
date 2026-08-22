"use client";

import { useEffect, useRef, useState } from "react";
import { Nfc, RefreshCw } from "lucide-react";
import { bridgeFetch } from "@/lib/client-api";

export default function CheckThePage() {
  const [uid, setUid] = useState("");
  const [status, setStatus] = useState("Sẵn sàng quét thẻ");
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  async function scan() {
    if (busy) return;
    setUid(""); setBusy(true); setStatus("Đang chờ đặt thẻ vào đầu đọc...");
    try {
      const start = await bridgeFetch("/api/rfid/scan/start", { method: "POST", body: JSON.stringify({ direction: "in", mode: "inventory" }) });
      if (!start.ok) throw new Error("Không thể khởi động đầu đọc RFID");
      timer.current = window.setInterval(async () => {
        const response = await bridgeFetch("/api/rfid/scan/poll?direction=in");
        const data = await response.json().catch(() => ({}));
        if (data.uid) {
          setUid(String(data.uid).toUpperCase()); setStatus("Đã đọc thẻ thành công"); setBusy(false);
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
        }
      }, 300);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không kết nối được đầu đọc"); setBusy(false);
    }
  }

  return <main style={{ maxWidth: 680, margin: "60px auto", padding: 24, fontFamily: "inherit" }}>
    <section style={{ padding: 32, border: "1px solid #dbe3ee", borderRadius: 18, background: "#fff", textAlign: "center", boxShadow: "0 10px 30px #102a430d" }}>
      <Nfc size={42} color="#2878e8" />
      <h1>Kiểm tra thẻ RFID</h1>
      <p style={{ color: "#64748b" }}>Dùng trang này để xác định UID thực tế mà đầu đọc nhận được.</p>
      <div style={{ margin: "28px 0", padding: 24, borderRadius: 12, background: "#f5f8fc", fontFamily: "monospace", fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>{uid || "—"}</div>
      <p>{status}</p>
      <button type="button" onClick={scan} disabled={busy} style={{ padding: "12px 22px", border: 0, borderRadius: 10, background: busy ? "#94a3b8" : "#2878e8", color: "#fff", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
        {busy ? <RefreshCw size={16} className="animate-spin" /> : <Nfc size={16} />} {busy ? "Đang quét..." : "Quét thẻ"}
      </button>
    </section>
  </main>;
}
