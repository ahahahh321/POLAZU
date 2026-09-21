const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.POLAZU_BASE_URL || "http://127.0.0.1:3000";
const projectId = process.env.POLAZU_PROJECT_ID;
const email = process.env.POLAZU_EMAIL;
const password = process.env.POLAZU_PASSWORD;
if (!projectId || !email || !password) {
  console.error("Set POLAZU_PROJECT_ID, POLAZU_EMAIL and POLAZU_PASSWORD for a disposable test account/project.");
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ channel:process.env.POLAZU_CHROME_CHANNEL || "chrome", headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
    page.on("pageerror", (error) => console.error("PAGEERROR", error.message));
    await page.goto(`${baseUrl}/login?next=${encodeURIComponent(`/editor?projectId=${projectId}`)}`);
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name:"로그인", exact:true }).click();
    await page.locator(".designer-studio").waitFor({ timeout:120000 });

    await page.getByRole("button", { name:/명령 검색/ }).click();
    await page.getByPlaceholder("명령 또는 도구 검색").fill("Tokens");
    await page.getByRole("button", { name:/Design Tokens 패널 열기/ }).click();
    await page.getByRole("button", { name:"Tokens" }).waitFor();

    await page.getByRole("button", { name:/반응형 나란히 보기/ }).click();
    await page.locator(".designer-responsive-compare").waitFor();
    assert.equal(await page.locator(".designer-responsive-compare article").count(), 3);
    await page.getByRole("button", { name:/반응형 나란히 보기/ }).click();

    await page.getByRole("button", { name:"Layers" }).click();
    const firstLayer = page.locator(".designer-layer-main").first();
    if (await firstLayer.count()) {
      await firstLayer.click();
      await page.locator(".designer-inspector-selection").waitFor();
    }

    await page.getByRole("button", { name:"Audit" }).click();
    await page.getByRole("button", { name:"Run" }).click();
    await page.screenshot({ path:path.join(os.tmpdir(), "polazu-designer-e2e.png"), fullPage:true });
    console.log("PASS: authenticated designer workspace, command palette, token panel, responsive compare, layers and audit");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
