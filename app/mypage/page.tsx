"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/header/BrandLogo";
import ProfileMenu from "@/components/header/ProfileMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import { readRegistrations, registryStorageKey, type Registration } from "@/components/component-registry";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSavedCommunity } from "@/components/community";
import { componentItems } from "../(home)/data";
import PersonalProfile from "./_components/PersonalProfile";
import "../(home)/reference-home.css";
import "./workspace.css";

export default function MyPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const saved = useSavedCommunity(user?.id);
  const bookmarks = componentItems.filter((item) => saved.ids.includes(item.id));
  const [items, setItems] = useState<Registration[]>([]);
  const [registryError, setRegistryError] = useState(false);

  useEffect(() => {
    if (!user) return;
    function refresh() {
      try {
        setItems(readRegistrations());
        setRegistryError(false);
      } catch {
        setRegistryError(true);
      }
    }
    function sync(event: StorageEvent) {
      if (event.key === null || event.key === registryStorageKey) refresh();
    }
    refresh();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [user]);

  return <div className="pz-home pz-workspace" data-home-theme={theme}>
    <a href="#workspace-main" className="skip-link">본문으로 이동</a>
    <header className="pz-header">
      <div className="pz-shell pz-header-row pz-workspace-top">
        <BrandLogo className="pz-logo" />
        <button className="pz-round" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}>{theme === "dark" ? "☼" : "☾"}</button>
        <ProfileMenu />
      </div>
      <nav className="pz-nav" aria-label="주요 메뉴">
        <Link href="/">Home</Link><Link href="/mypage/" aria-current="page">Workspace</Link>
        <Link href="/community/">Community</Link><Link href="/convert/">Convert</Link>
      </nav>
    </header>
    <main id="workspace-main" className="pz-shell pz-workspace-main">
      {!user ? <section className="pz-workspace-panel pz-workspace-empty">
        <h1>내 작업 공간</h1>
        <p>{loading ? "로그인 상태를 확인하고 있어요." : "로그인하면 등록한 UI와 커뮤니티에서 저장한 UI를 볼 수 있어요."}</p>
        {!loading && <Link className="pz-primary" href="/login/">로그인</Link>}
      </section> : <>
        <PersonalProfile key={user.id} user={user} />
        <nav className="pz-workspace-jumps" aria-label="작업 공간 메뉴">
          <a href="#components">내 작품</a><a href="#saved-ui">저장한 UI</a><a href="#projects">프로젝트 도구</a><a href="#account">계정 정보</a>
        </nav>
        <section className="pz-workspace-panel" id="components" aria-labelledby="components-title">
          <div className="pz-workspace-section-title"><h2 id="components-title">내 작품</h2><span className="pz-pill">{items.length}개</span><Link className="pz-pill pz-portfolio-add" href="/upload/">+ UI 등록</Link></div>
          <p>이 브라우저에 등록한 React 소스와 스타일을 다시 받을 수 있어요.</p>
          {registryError ? <p role="alert">등록 목록을 읽지 못했어요.</p>
            : items.length === 0 ? <div className="pz-workspace-empty"><strong>아직 등록한 UI가 없어요</strong><p>React 컴포넌트와 CSS를 올려 첫 번째 UI를 등록해 보세요.</p><Link className="pz-secondary" href="/upload/">첫 UI 등록하기 →</Link></div>
            : <ul className="pz-workspace-files">{items.map(item => <li key={item.id}>
              <span className="pz-portfolio-mark" aria-hidden="true">&lt;/&gt;</span>
              <div><h3>{item.name}</h3><p>{item.filename}</p></div>
              <div className="pz-workspace-downloads">
                <a className="pz-pill" download={item.filename} href={`data:text/plain;charset=utf-8,${encodeURIComponent(item.source)}`}>React 소스 ↓</a>
                {item.cssFilename && <a className="pz-pill" download={item.cssFilename} href={`data:text/css;charset=utf-8,${encodeURIComponent(item.css ?? "")}`}>CSS ↓</a>}
              </div>
            </li>)}</ul>}
        </section>
        <section className="pz-workspace-panel" id="saved-ui" aria-labelledby="saved-ui-title">
          <div className="pz-workspace-section-title">
            <h2 id="saved-ui-title">저장한 UI</h2>{saved.ready && <span className="pz-pill">{bookmarks.length}개</span>}
            <Link className="pz-pill pz-portfolio-add" href="/community/">커뮤니티 탐색 →</Link>
          </div>
          <p>커뮤니티에서 저장한 레퍼런스를 여기서 다시 열 수 있어요.</p>
          {saved.error && <p role="alert">{saved.error} <button className="pz-pill" type="button" onClick={saved.retry}>다시 시도</button></p>}
          {saved.ready ? (bookmarks.length > 0 ? <ul className="pz-workspace-files">{bookmarks.map((item) => <li key={item.id}>
            <span className="pz-portfolio-mark" aria-hidden="true">♥</span>
            <div><h3><Link href={"/community/?q=" + encodeURIComponent(item.title)}>{item.title}</Link></h3><p>{item.category} · {item.author}</p></div>
            <button className="pz-pill" type="button" disabled={saved.pending} aria-label={item.title + " 저장 취소"}
              onClick={() => void saved.toggle(item.id)}>저장 취소</button>
          </li>)}</ul> : <div className="pz-workspace-empty"><strong>아직 저장한 UI가 없어요</strong><p>마음에 드는 UI 카드에서 ♡ 저장을 눌러 보세요.</p></div>)
            : !saved.error && <p>저장한 UI를 불러오는 중이에요.</p>}
        </section>
        <section className="pz-workspace-panel" id="projects" aria-labelledby="projects-title">
          <h2 id="projects-title">프로젝트 도구</h2><p>프로젝트를 불러오거나, 제공 예시로 버튼 동작을 확인할 수 있어요.</p>
          <div className="pz-workspace-tools"><Link href="/editor/?mode=project" className="pz-secondary">프로젝트 편집기 →</Link><Link href="/playground/button/" className="pz-secondary">버튼 테스트 →</Link></div>
        </section>
        <section className="pz-workspace-panel" id="account" aria-labelledby="account-title">
          <h2 id="account-title">계정 정보</h2>
          <dl className="pz-workspace-account"><div><dt>이메일</dt><dd>{user.email}</dd></div><div><dt>닉네임</dt><dd>{user.nickname}</dd></div></dl>
        </section>
      </>}
    </main>
  </div>;
}
