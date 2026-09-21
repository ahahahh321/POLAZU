import Link from "next/link";
import type { MouseEvent } from "react";

export default function HeroSection() {
  function scrollToComponents(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.querySelector("#browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="main-hero" aria-labelledby="hero-heading">
      <div className="main-hero-content">
        <p className="main-kicker"><span /> DESIGN. EDIT. SHIP.</p>
        <h1 id="hero-heading">아이디어를<br />실제로 작동하는<br /><em>UI로.</em></h1>
        <p className="main-hero-copy">
          저장한 컴포넌트와 기존 프로젝트를 불러오고, 화면에서 수정한 결과를
          실시간 코드와 동작으로 확인하세요.
        </p>
        <div className="main-hero-actions">
          <Link href="/editor/?demo=1" className="main-primary-action">샘플 프로젝트 체험 <span aria-hidden="true">↗</span></Link>
          <a href="#browse" className="main-secondary-action" onClick={scrollToComponents}>컴포넌트 둘러보기 <span aria-hidden="true">↓</span></a>
        </div>
        <p className="main-hero-note">로그인 없이 샘플 체험 가능 · 브라우저에서 실행</p>
      </div>
      <div className="main-hero-demo" aria-label="POLAZU UI Editor 미리보기">
        <div className="main-demo-topbar"><span /><span /><span /><strong>UI EDITOR</strong></div>
        <div className="main-demo-body">
          <aside><b>UI 목록</b><span className="active">Newsletter signup</span><span>Primary actions</span><span>Product hero</span><b>레이어</b><span>Form</span><span>Input</span><span>Button</span></aside>
          <div className="main-demo-canvas">
            <div className="main-demo-card"><small>STAY IN THE LOOP</small><h2>Build better interfaces.</h2><p>Get practical UI patterns delivered weekly.</p><div><span>email@example.com</span><button>Subscribe</button></div></div>
          </div>
          <aside className="main-demo-properties"><b>PROPERTIES</b><label>Text<input readOnly value="Subscribe" /></label><label>Background<span className="color" /></label><label>Radius<input readOnly value="12 px" /></label></aside>
        </div>
        <div className="main-demo-status"><span>● 편집 가능</span><span>변경사항이 실시간으로 반영됩니다.</span></div>
      </div>
    </section>
  );
}
