const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async()=>{
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 try {
  await page.goto("http://127.0.0.1:3000/editor/");
  page.on("console",m=>{if(m.type()==="error")console.log("CONSOLE",m.text());});
  page.on("pageerror",e=>console.log("PAGEERROR",e.message));
  await page.getByRole("button",{name:"데모로 시작하기"}).click();
  await page.locator(".studio-bottom .online").waitFor({timeout:90000});
  await page.getByLabel("확대 비율").selectOption("75");
  const frame=page.frameLocator('iframe[title="프로젝트 미리보기"]');
  // Chromium OOPIF의 locator 좌표 계산은 축소된 iframe에서 어긋날 수 있어
  // 실제 화면 좌표로 마우스를 움직여 사용자 클릭을 검증합니다.
  async function canvasClick(locator){
    await locator.scrollIntoViewIfNeeded();
    const inner=await locator.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth}});
    const box=await page.locator('iframe[title="프로젝트 미리보기"]').boundingBox();
    await page.mouse.click(box.x+inner.x*box.width/inner.w,box.y+inner.y*box.width/inner.w);
  }
  await canvasClick(frame.getByText("Start with curiosity.",{exact:true}));
  await page.getByRole("textbox",{name:"선택한 요소 텍스트"}).fill("A new idea.");
  await page.getByRole("button",{name:"디자인 적용",exact:true}).click();
  await frame.getByText("A new idea.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"실행 취소",exact:true}).click();
  await frame.getByText("Start with curiosity.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"다시 실행",exact:true}).click();
  await frame.getByText("A new idea.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"저장",exact:true}).click();
  const persisted=await page.evaluate(()=>Object.entries(localStorage).some(([k,v])=>k.startsWith("polazu-edits:")&&v.includes("A new idea.")));
  assert(persisted);
  await canvasClick(frame.getByRole("button",{name:"Try sample API"}));
  await page.getByRole("button",{name:"비활성",exact:true}).click();
  assert(await frame.getByRole("button",{name:"Try sample API"}).isDisabled());
  await page.getByRole("button",{name:"기본",exact:true}).click();
  await page.getByRole("button",{name:"▷ Preview",exact:true}).click();
  await canvasClick(frame.getByRole("button",{name:"Try sample API"}));
  await frame.locator("#result").filter({hasText:"샘플 응답"}).waitFor();
  await canvasClick(frame.getByRole("link",{name:"Our story"}));
  await frame.getByRole("heading",{name:"Our story"}).waitFor({timeout:90000});
  await canvasClick(frame.getByRole("link",{name:"Back home"}));
  await frame.getByText("A new idea.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"↖ Design",exact:true}).click();
  await canvasClick(frame.getByText("A new idea.",{exact:true}));
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'polazu-studio-tested.png'),fullPage:true});
  console.log("PASS: render, selection, edit, undo/redo, save, disabled/default, fetch mock, link navigation, edit replay");
 } catch(e) {
  console.log('FAILED STATUS',await page.locator('.studio-bottom').innerText().catch(()=>''));
  for(const f of page.frames())console.log('FRAME',f.url(),(await f.locator('body').innerText({timeout:2000}).catch(()=>'' )).slice(0,1000));
  throw e;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
