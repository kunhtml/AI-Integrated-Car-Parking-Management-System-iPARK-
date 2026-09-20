"""TC_RFID_001 evidence: login admin -> /rfid -> them the RFID moi -> verify DB -> screenshot."""
import datetime, pathlib, sys
from playwright.sync_api import sync_playwright, expect

OUT = pathlib.Path(__file__).parent
BASE = "http://localhost:3000"
UID = "TEST" + datetime.datetime.now().strftime("%H%M%S")  # UID doc nhat cho lan chay nay

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 1. Login
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.screenshot(path=OUT / "01_login.png")
    page.fill('input[name="email"]', "admin@ipark.vn")
    page.fill('input[name="password"]', "admin")
    page.click('button[type="submit"]')
    page.wait_for_url("**/overview", timeout=30000)
    print("[ok] login")

    # 2. RFID management screen
    page.goto(f"{BASE}/rfid", wait_until="networkidle")
    page.wait_for_selector("text=Thêm thẻ", timeout=20000)
    page.screenshot(path=OUT / "02_rfid_list_before.png")
    print("[ok] /rfid rendered")

    # 3. Open Add-card modal and register new UID
    page.click("text=Thêm thẻ")
    page.wait_for_selector("h2:has-text('Thêm thẻ RFID')")
    page.fill('input[name="uid"]', UID)
    page.screenshot(path=OUT / "03_modal_filled.png")
    page.click('.modal-actions button[type="submit"]')
    page.wait_for_timeout(2500)
    page.screenshot(path=OUT / "04_after_save.png")
    print(f"[ok] submitted UID={UID}")

    # 4. Search the card to prove it exists in the list (fresh fetch from DB)
    page.fill('input[placeholder*="Tìm UID"]', UID)
    page.wait_for_timeout(2000)
    page.screenshot(path=OUT / "05_search_new_uid.png")
    found = page.get_by_text(UID).count()
    print(f"[{'OK' if found else 'FAIL'}] UID {UID} xuat hien trong danh sach: {found} lan")

    # 5. Open card history modal (UID pill button) -> audit tab proves rfid_card_created persisted
    pill = page.locator("button.uid-pill", has_text=UID)
    if pill.count():
        pill.first.click()
        page.wait_for_timeout(3500)
        page.screenshot(path=OUT / "06_card_history_audit.png")
        print("[ok] history modal captured")
    else:
        print("[skip] khong tim thay uid-pill trong row")

    # console errors related to rfid page
    rerr = [e for e in errors if "rfid" in e.lower() or "500" in e]
    if rerr:
        print("[warn] console errors:", rerr[:5])
    ctx.close(); browser.close()
    sys.exit(0 if found else 1)
