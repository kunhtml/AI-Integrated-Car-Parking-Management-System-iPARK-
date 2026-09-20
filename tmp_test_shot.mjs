
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('screenshots_manual', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots_manual/01_public_landing.png' });
console.log('Public landing captured successfully!');
await browser.close();
