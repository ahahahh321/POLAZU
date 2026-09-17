const fs=require("fs");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
const page=await browser.newPage();
page.on("console",m=>console.log(m.type(),m.text()));
page.on("pageerror",e=>console.log("ERR",e.message));
await page.route("http://polazu-test.local/",r=>r.fulfill({contentType:"text/html",body:'<iframe id="preview" srcdoc="<h3>Test heading</h3><button>Try</button>"></iframe>'}));
await page.goto("http://polazu-test.local/");
await page.evaluate(()=>{window.messages=[];window.addEventListener("message",e=>{window.messages.push(e.data);console.log("MSG",JSON.stringify(e.data));});});
const frame=page.frames()[1];
await frame.evaluate(()=>window.__POLAZU_CONFIG__={token:"test",origin:"http://polazu-test.local"});
await frame.addScriptTag({content:fs.readFileSync("public/editor-bridge.js","utf8")});
await frame.getByText("Test heading").click();
console.log("MESSAGES",await page.evaluate(()=>window.messages));
await page.waitForFunction(()=>window.messages.some(m=>m.type==='selected'));
assert.equal(await frame.evaluate(async()=> (await fetch('http://polazu-test.local/unconfigured-write',{method:'POST'})).status),501);
assert.equal(await frame.evaluate(async()=> (await fetch('http://polazu-test.local/api/missing')).status),501);
assert(await page.evaluate(()=>window.messages.some(m=>m.type==='selected'&&m.element.text==='Test heading')));
console.log('PASS: selection and unmatched API/write-request blocking');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
