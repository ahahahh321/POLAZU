const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.POLAZU_BASE_URL || "http://127.0.0.1:3000";
const projectId = process.env.POLAZU_PROJECT_ID;
if (!projectId) { console.error("Set POLAZU_PROJECT_ID and provide a Playwright storage state through POLAZU_STORAGE_STATE."); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ channel:process.env.POLAZU_CHROME_CHANNEL || "chrome", headless:true });
  try {
    const context = await browser.newContext(process.env.POLAZU_STORAGE_STATE ? { storageState:process.env.POLAZU_STORAGE_STATE } : {});
    const page = await context.newPage({ viewport:{ width:1600, height:1000 } });
    page.on("console", (message) => { if (message.type() === "error") console.log("CONSOLE", message.text().slice(0,1600)); });
    page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
    await page.goto(`${baseUrl}/editor?projectId=${projectId}`);
    await page.locator(".designer-studio").waitFor({ timeout:120000 });
    console.log("STATUS", await page.locator(".designer-statusbar").innerText());
    console.log("LAYERS", await page.locator(".designer-layer-row").count());
    console.log("TOKENS", await page.locator(".designer-token-row").count());
    await page.screenshot({ path:path.join(os.tmpdir(), "polazu-designer-probe.png"), fullPage:true });
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
