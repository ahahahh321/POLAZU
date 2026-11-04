"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { registrationLoginPath } from "@/components/auth/registration-route";
import BrandLogo from "@/components/header/BrandLogo";
import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { readRegistrations, registryStorageKey, type Registration } from "@/components/component-registry";
import "../(home)/reference-home.css";
import "../playground/button/playground.css";
import "./register.css";

const fileLimit = 100_000;

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState<Registration[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace(registrationLoginPath);
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    try {
      setItems(readRegistrations());
      setReady(true);
    } catch {
      setError("브라우저에 보관된 등록 목록을 읽을 수 없습니다.");
    }
  }, [user]);

  if (loading || !user) {
    return <div className="pz-home" data-home-theme={theme}>
      <main className="pz-shell pz-lab" role="status">로그인 상태를 확인하고 있습니다.</main>
    </div>;
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const sourceFile = data.get("source");
    const cssFile = data.get("css");
    const hasCss = cssFile instanceof File && cssFile.name !== "";
    setError("");
    setNotice("");
    if (!name || !(sourceFile instanceof File) || !/\.(tsx|jsx)$/i.test(sourceFile.name) || !sourceFile.size || sourceFile.size > fileLimit) {
      setError("이름과 100KB 이하의 TSX 또는 JSX 파일을 입력하세요.");
      return;
    }
    if (hasCss && (!/\.css$/i.test(cssFile.name) || cssFile.size > fileLimit)) {
      setError("스타일 파일은 100KB 이하의 CSS만 등록할 수 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const source = await sourceFile.text();
      if (!source.trim()) throw Error("소스 파일에 컴포넌트 코드를 넣어주세요.");
      const item: Registration = { id: crypto.randomUUID(), name, source, filename: sourceFile.name };
      if (hasCss) {
        item.css = await cssFile.text();
        item.cssFilename = cssFile.name;
      }
      const next = [item, ...readRegistrations()];
      localStorage.setItem(registryStorageKey, JSON.stringify(next));
      setItems(next);
      form.reset();
      setNotice(name + " 컴포넌트 코드를 등록했습니다.");
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("소스 파일")
        ? cause.message : "파일을 읽거나 브라우저에 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="pz-home" data-home-theme={theme}>
    <header className="pz-header"><div className="pz-shell pz-header-row">
      <BrandLogo className="pz-logo" /><Link className="pz-pill" href="/community/">레퍼런스 둘러보기</Link>
    </div></header>
    <main className="pz-shell pz-lab">
      <p className="pz-lab-kicker">COMPONENT REGISTRY</p>
      <h1>컴포넌트 등록</h1>
      <p>React 컴포넌트 소스와 스타일을 이 브라우저에 보관하세요.</p>
      <section className="pz-lab-panel">
        <h2>React 소스 올리기</h2>
        <form className="pz-register-form" onSubmit={(event) => void register(event)}>
          <label>컴포넌트 이름<input name="name" required maxLength={80} placeholder="예: 예약 버튼" /></label>
          <label>React 소스 파일<input name="source" type="file" required accept=".tsx,.jsx" /></label>
          <label>스타일 파일 (선택)<input name="css" type="file" accept=".css" /></label>
          <button className="pz-primary" disabled={!ready || busy}>{busy ? "등록 중…" : "컴포넌트 등록"}</button>
        </form>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
      <section className="pz-lab-panel">
        <h2>등록한 컴포넌트</h2>
        <p>현재 등록은 소스 보관과 다운로드를 지원합니다. 미리보기 실행은 POLAZU 제공 Button에서 체험할 수 있습니다.</p>
        <Link className="pz-more" href="/playground/button/">Button 테스트 열기 →</Link>
        {items.length === 0 && <p>등록한 컴포넌트가 없습니다.</p>}
        {items.map((item) => <article className="pz-register-item" key={item.id}>
          <h3>{item.name}</h3>
          <div className="pz-lab-downloads">
            <a className="pz-secondary" download={item.filename} href={`data:text/plain;charset=utf-8,${encodeURIComponent(item.source)}`}>{item.filename}</a>
            {item.cssFilename && <a className="pz-secondary" download={item.cssFilename} href={`data:text/css;charset=utf-8,${encodeURIComponent(item.css ?? "")}`}>{item.cssFilename}</a>}
          </div>
          <details><summary>등록한 소스 보기</summary><pre>{item.source}</pre></details>
        </article>)}
      </section>
    </main>
  </div>;
}
