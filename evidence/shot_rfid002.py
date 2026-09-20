"""TC_RFID_002 evidence: lock card then Activate ('Mo khoa') via /rfid UI."""
import pathlib, sys
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).parent
BASE = "http://localhost:3000"
UID = "TEST015340"  # card created in TC_RFID_001

api_fail = []
page_err = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    def on_resp(res):
        if "/api/" in res.url and res.status >= 400:
            api_fail.append(f"{res.status} {res.request.method} {res.url}")
    page.on("response", on_resp)
    page.on("pageerror", lambda e: page_err.append(str(e)))

    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[name="email"]', "admin@ipark.vn")
    page.fill('input[name="password"]', "admin")
    page.click('button[type="submit"]')
    page.wait_for_url("**/overview", timeout=30000)

    page.goto(f"{BASE}/rfid", wait_until="networkidle")
    page.fill('input[placeholder*="Tìm UID"]', UID)
    page.wait_for_timeout(2000)
    page.screenshot(path=OUT / "07_rfid002_before.png")

    # Step 1: lock the card (available -> blocked)
    row = page.locator("tr", has_text=UID)
    lock_btn = row.locator('button[title="Khóa thẻ"], button:has-text("Khóa")').first
    lock_btn.click()
    page.wait_for_selector("textarea", timeout=10000)
    page.fill("textarea", "Test TC_RFID_002: tam khoa de kich hoat lai")
    page.screenshot(path=OUT / "08_rfid002_lock_modal.png")
    page.click('button.danger:has-text("Khóa")')
    page.wait_for_timeout(2500)
    page.screenshot(path=OUT / "09_rfid002_after_lock.png")
    row = page.locator("tr", has_text=UID)
    locked = row.locator("text=/Đã khóa|Blocked/i").count()
    print(f"[step] card locked: badge_found={locked}")

    # Step 2: Activate — the row button now reads 'Mo khoa' (unlock -> active)
    act_btn = page.locator("tr", has_text=UID).locator('button:has-text("Mở khóa")').first
    if act_btn.count() == 0:
        print("[FAIL] khong thay nut Mo khoa (Activate)")
        print("       api_fail:", api_fail[:5])
        sys.exit(1)
    act_btn.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=OUT / "10_rfid002_after_activate.png")

    # Verify status badge on the row + toast message
    row = page.locator("tr", has_text=UID)
    active_badge = row.locator("text=/Đang kích hoạt|Đang hoạt động|Active|Sẵn sàng/i").count()
    toast = page.locator("text=/mở khóa/i").count()
    print(f"[ok] activated: badge_count={active_badge} toast={toast}")

    # Card history modal shows the status-change audit entries
    page.locator("button.uid-pill", has_text=UID).first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=OUT / "11_rfid002_history_audit.png")

    if api_fail:
        print("[warn] api failures:", api_fail[:5])
    if page_err:
        print("[warn] page errors:", page_err[:5])
    ctx.close(); browser.close()
    sys.exit(0 if (locked and active_badge) else 1)
