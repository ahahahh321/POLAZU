"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityComments from "@/app/community/CommunityComments";
import { useSavedCommunity } from "@/components/community";
import AuthDialog from "@/components/auth/AuthDialog";
import BrandLogo from "@/components/header/BrandLogo";
import ProfileMenu from "@/components/header/ProfileMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import { registrationLoginPath, registrationPath } from "@/components/auth/registration-route";
import { useTheme } from "@/components/theme/ThemeProvider";
import { categories, componentItems, type ComponentItem } from "./data";
import { useHomeFilters } from "./_hooks/useHomeFilters";
import "./reference-home.css";

function Preview({ item }: { item: ComponentItem }) {
  return <div className="pz-preview" aria-hidden="true">
    {item.category === "Buttons" ? <span className="pz-demo-button">Get started</span>
      : item.id === 1 ? <div className="pz-demo-form"><small>Email address</small><span>hello@polazu.io</span></div>
      : item.id === 2 ? <div className="pz-demo-form"><small>Quick search</small><span>⌕ Find anything</span></div>
      : item.category === "Pages" ? <div className="pz-demo-form"><small>Revenue</small><strong>$172,560</strong><small className="pz-accent">▲ 12.4%</small></div>
      : <div className="pz-wire"><i /><i /><i /><b /></div>}
  </div>;
}

export default function ReferenceExperience({ community = false }: { community?: boolean }) {
  const router = useRouter();
  const [auth, setAuth] = useState<{ mode: "login" | "signup"; register: boolean } | null>(null);
  const { query, setQuery, category, setCategory, items, resetFilters } = useHomeFilters();
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();
  const { ids: savedIds, toggle: toggleSaved, error: savedError, pending, ready, retry } = useSavedCommunity(community ? user?.id : undefined);
  const [discussionId, setDiscussionId] = useState<number>();
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState("recommended");
  const keyword = query.trim();
  const searching = community && keyword.length > 0;
  const search = useRef<HTMLInputElement>(null);
  const matchingItems = community
    ? (savedOnly ? items.filter((item) => savedIds.includes(item.id)) : items)
    : componentItems.slice(0, 4);
  const visibleItems = searching && sort === "title"
    ? [...matchingItems].sort((first, second) => first.title.localeCompare(second.title))
    : matchingItems;
  const relatedTerms = searching
    ? [...new Set(visibleItems.flatMap((item) => item.tags))]
      .filter((tag) => tag.toLowerCase() !== keyword.toLowerCase()).slice(0, 6)
    : [];

  useEffect(() => {
    if (!community) return;
    function readQuery() {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    }
    readQuery();
    window.addEventListener("popstate", readQuery);
    return () => window.removeEventListener("popstate", readQuery);
  }, [community, setQuery]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (document.querySelector(".pz-auth-dialog[open]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function requireLogin() {
    setAuth({ mode: "login", register: false });
  }

  function commitQuery(value: string) {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value.trim());
    else url.searchParams.delete("q");
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  }

  return <div className="pz-home" data-home-theme={theme} data-auth-open={auth ? "" : undefined}>
    <a href="#main-content" className="skip-link">본문으로 이동</a>
    <header className="pz-header">
      <div className="pz-shell pz-header-row">
        <BrandLogo className="pz-logo" />
        <form role="search" className="pz-search" action="/community/" onSubmit={community ? (event) => {
          event.preventDefault();
          commitQuery(query);
        } : undefined}>
          <label htmlFor="pz-search" className="sr-only">컴포넌트 검색</label>
          <input id="pz-search" name="q" ref={search} type="search" value={community ? query : undefined}
            onChange={community ? (event) => setQuery(event.target.value) : undefined}
            placeholder="컴포넌트를 검색해 보세요" />
          <button type="submit" aria-label="검색 결과 보기">⌕</button>
        </form>
        <button className="pz-round" type="button" onClick={toggleTheme}
          aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}>{theme === "dark" ? "☼" : "☾"}</button>
        {!user && <button className="pz-pill" type="button" onClick={() => setAuth({ mode: "login", register: false })}>Sign in</button>}
        <ProfileMenu onGuestAuth={(mode) => setAuth({ mode, register: false })} />
      </div>
      <nav className="pz-nav" aria-label="주요 메뉴">
        <Link href="/" aria-current={community ? undefined : "page"}>Home</Link>
        <Link href="/mypage/">Workspace</Link>
        <Link href="/community/" aria-current={community ? "page" : undefined}>Community</Link>
        <Link href="/convert/">Convert</Link>
      </nav>
    </header>

    <main id="main-content">
      {community ? !searching && <section className="pz-shell pz-community-intro">
        <span className="pz-pill">POLAZU COMMUNITY</span>
        <h1>UI 레퍼런스 탐색</h1>
        <p>UI를 찾고, 마음에 드는 레퍼런스를 저장하고, 의견을 나눠 보세요.</p>
      </section> : <section className="pz-hero pz-shell" aria-labelledby="hero-heading">
        <span className="pz-pill pz-announcement"><i /> NEW · AST 자동 코드 변환 html → react</span>
        <h1 id="hero-heading">BUILD YOUR UI<br /><em>YOUR WAY</em></h1>
        <p>컴포넌트를 고르고, 속성을 바꾸고, 내 프로젝트 코드로 바로 가져가세요.</p>
        <div className="pz-actions">
          <Link className="pz-primary" href="/editor/?mode=project">GO WORKSPACE <span aria-hidden="true">→</span></Link>
          <Link className="pz-secondary" href="/convert/">CONVERT CODE <span aria-hidden="true">→</span></Link>
        </div>
        <ul className="pz-hero-meta" aria-label="POLAZU에서 둘러볼 수 있는 UI">
          <li><strong>{componentItems.length}</strong><span>UI 레퍼런스</span></li>
          <li><strong>{new Set(componentItems.map((item) => item.category)).size}</strong><span>카테고리</span></li>
          <li><strong>React</strong><span>지원 형식</span></li>
        </ul>
      </section>}

      <section id="browse" className={searching ? "pz-shell pz-section pz-search-results" : "pz-shell pz-section"} aria-labelledby="browse-heading">
        <div className="pz-section-head">
          {searching ? <>
            <h1 id="browse-heading">“{keyword}” <span>Components</span></h1>
            <p className="pz-result-count" role="status">검색 결과 {visibleItems.length}개</p>
          </> : <h2 id="browse-heading">{community ? "컴포넌트 둘러보기" : "RECOMMENDED"}</h2>}
          {community && !searching && <button className="pz-pill" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>저장한 UI · {savedIds.length}</button>}
          {!community && <Link className="pz-pill pz-gallery-more" href="/community/">전체 보기 →</Link>}
        </div>
        {community && <div className="pz-filter-bar">
          <nav className="pz-filters" aria-label="컴포넌트 카테고리">{categories.map((entry) =>
            <button key={entry} className="pz-pill" aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry === "All Components" && searching ? "All" : entry}</button>)}</nav>
          {searching && <div className="pz-search-controls">
            <button className="pz-pill" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>저장한 UI · {savedIds.length}</button>
            <select className="pz-pill pz-search-sort" aria-label="검색 결과 정렬" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recommended">추천순</option>
              <option value="title">이름순</option>
            </select>
          </div>}
        </div>}
        {relatedTerms.length > 0 && <nav className="pz-related-search" aria-label="연관 검색어">
          <span>연관 검색어</span>
          {relatedTerms.map((term) => <button key={term} type="button" className="pz-pill" onClick={() => {
            setCategory("All Components");
            commitQuery(term);
          }}># {term}</button>)}
        </nav>}
        {!searching && <p className="sr-only" aria-live="polite">{visibleItems.length}개의 컴포넌트</p>}
        {community && savedError && <p className="pz-save-error" role="alert">{savedError} <button className="pz-pill" type="button" onClick={retry}>다시 시도</button></p>}
          {visibleItems.length ? <div className="pz-recommend-grid">{visibleItems.map((item) =>
            <article className="pz-reference-card" key={item.id} aria-label={item.title}>
              <Preview item={item} />
              <div className="pz-reference-info"><h3>{item.title}</h3><p>{item.description}</p>
                {item.category === "Buttons" && <Link className="pz-pill" href="/playground/button/">테스트 · React 소스</Link>}
                <div><span><i />{item.author}</span></div>
                {community && <div className="pz-card-actions">
                  <button className="pz-pill" type="button" aria-expanded={discussionId === item.id}
                    onClick={() => setDiscussionId(discussionId === item.id ? undefined : item.id)}>의견</button>
                  <button className="pz-pill" type="button" aria-pressed={savedIds.includes(item.id)}
                    aria-label={item.title + (savedIds.includes(item.id) ? " 저장 취소" : " 저장")}
                    disabled={loading || (!!user && (!ready || pending))}
                    onClick={() => user ? void toggleSaved(item.id) : requireLogin()}>
                    {savedIds.includes(item.id) ? "♥ 저장됨" : "♡ 저장"}
                  </button>
                </div>}
              </div>
              {community && discussionId === item.id && <CommunityComments id={item.id} signedIn={!!user} onLogin={requireLogin} />}
            </article>)}</div> : <div className="pz-empty">검색 조건에 맞는 컴포넌트가 없습니다. <button onClick={() => { resetFilters(); commitQuery(""); setSavedOnly(false); }}>전체 보기</button></div>}
      </section>
    </main>
    <footer className="pz-footer"><div className="pz-shell"><BrandLogo className="pz-logo" /><span>© 2026 POLAZU · UI 컴포넌트 &amp; UX 공유 서비스</span></div></footer>
    <Link className="pz-primary pz-register-fab" href={user || loading ? registrationPath : registrationLoginPath} aria-label="UI 등록" title="UI 등록"
      onClick={(event) => {
        if (user) return;
        event.preventDefault();
        setAuth({ mode: "login", register: true });
      }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Link>
    {auth && <AuthDialog mode={auth.mode}
      onSwitch={(mode) => setAuth({ ...auth, mode })}
      onClose={() => setAuth(null)}
      onLogin={() => {
        setAuth(null);
        if (auth.register) router.push(registrationPath);
      }} />}
  </div>;
}
