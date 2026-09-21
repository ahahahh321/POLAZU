const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: process.env.POLAZU_CHROME_CHANNEL || "chrome", headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1280, height:800 } });
    page.on("pageerror", (error) => console.error("PAGEERROR", error.message));
    await page.route("http://polazu-test.local/", (route) => route.fulfill({
      contentType:"text/html",
      body:`<!doctype html><html><body><iframe id="preview" style="width:900px;height:650px" srcdoc='<main data-polazu-source="/app/page.tsx:3:4" style="padding:32px"><h1 data-polazu-source="/app/page.tsx:4:6" style="color:#777;background:#fff">Bridge heading</h1><button data-polazu-source="/app/page.tsx:5:6">Action</button><img src="/missing.png"></main>'></iframe></body></html>`,
    }));
    await page.goto("http://polazu-test.local/");
    await page.evaluate(() => { window.messages=[]; window.addEventListener("message", (event) => window.messages.push(event.data)); });
    const frame = page.frames()[1];
    await frame.evaluate(() => { window.__POLAZU_CONFIG__={ token:"test-token", origin:"http://polazu-test.local" }; });
    await frame.addScriptTag({ content:fs.readFileSync("public/editor-bridge.js", "utf8") });
    await page.waitForFunction(() => window.messages.some((message) => message?.type === "ready"));

    await frame.getByText("Bridge heading", { exact:true }).click();
    await page.waitForFunction(() => window.messages.some((message) => message?.type === "selected" && message.element?.text === "Bridge heading"));

    await page.evaluate(() => document.querySelector("#preview").contentWindow.postMessage({ source:"polazu-editor", token:"test-token", type:"command", command:"insert", payload:{ kind:"badge" } }, location.origin));
    await page.waitForFunction(() => window.messages.some((message) => message?.type === "structure" && message.edit?.operation?.kind === "badge"));

    await page.evaluate(() => document.querySelector("#preview").contentWindow.postMessage({ source:"polazu-editor", token:"test-token", type:"command", command:"audit", payload:{} }, location.origin));
    await page.waitForFunction(() => window.messages.some((message) => message?.type === "audit-result"));
    const audit = await page.evaluate(() => window.messages.findLast((message) => message?.type === "audit-result"));
    assert(audit.issues.some((issue) => issue.rule === "image-alt"));
    assert(audit.issues.some((issue) => issue.rule === "broken-asset"));

    const missingApi = await frame.evaluate(async () => (await fetch("/api/missing")).status);
    assert.equal(missingApi, 501);
    console.log("PASS: bridge ready, source-linked selection, primitive insert, audit and unmatched API blocking");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
