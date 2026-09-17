const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
 const browser = await chromium.launch({ channel: "chrome", headless: true });
 try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
 page.on("console", m => { if(m.type()==="error") console.log("CONSOLE",m.text().slice(0,1600)); });
 page.on("pageerror",e=>console.log("PAGEERROR",e.message));
 page.on("requestfailed",r=>console.log("REQUESTFAIL",r.url().slice(0,120),r.failure()));
 await page.goto("http://127.0.0.1:3000/editor/");
 if(process.argv.includes("--demo")) await page.getByRole("button",{name:"데모로 시작하기"}).click();
 else {
 await page.locator("input[type=url]").fill("https://github.com/ahahahh321/POLAZU");
 await page.locator(".editor-branch input").fill("main");
 await page.getByRole("button",{name:"프로젝트 불러오기"}).click();
 }
 await page.locator(".studio-bottom").waitFor({timeout:60000});
 for(let i=0;i<85;i++) {
   await page.waitForTimeout(5000);
   console.log("STATE",i,await page.locator(".studio-bottom").innerText(),await page.locator(".studio-loading-card").allTextContents());
   if(await page.locator(".studio-bottom .online").count() || await page.locator(".studio-error-icon").count())break;
 }
 await page.getByRole("button",{name:"⌘ 로그 열기"}).click().catch(()=>{});
 console.log("LOG",await page.locator(".studio-console").innerText().catch(()=>""));
 for(const f of page.frames().filter(f=>f.url().includes("4173"))) console.log("FRAME",f.url(),(await f.locator("body").innerText({timeout:3000}).catch(()=>"")).slice(0,10000));
 await page.screenshot({path:require("node:path").join(require("node:os").tmpdir(),"polazu-next-probe.png"),fullPage:true});
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
