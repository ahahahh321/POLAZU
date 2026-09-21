"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Header from "@/components/header/Header";
import BrowserProjectRuntime from "./_components/BrowserProjectRuntime";
import SavedUiEditor from "./_components/SavedUiEditor";
import type { Project } from "./_lib/types";
import { demo } from "./_lib/demo";
import "./page.css";

export default function EditorPage() {
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(true);
  const [studioMode, setStudioMode] = useState<"project" | "ui">("project");
  const [routeReady, setRouteReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "ui") setStudioMode("ui");
    if (params.get("demo") === "1") {
      setProject(demo);
      setShowImport(false);
    }
    setRouteReady(true);
  }, []);

  async function load(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080") +
          "/api/editor/import/github",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryUrl: url, ref: branch || null }),
          signal: AbortSignal.timeout(45000),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "가져오기 실패");
      setProject(result);
      setShowImport(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기 실패");
    } finally {
      setBusy(false);
    }
  }

  async function local(files: FileList | null) {
    if (!files) return;
    setError("");
    setBusy(true);
    try {
      const text: Record<string, string> = {};
      const binary: Record<string, string> = {};
      let size = 0;
      let skipped = 0;
      let count = 0;
      const projectName =
        files[0]?.webkitRelativePath.split("/")[0] || "Local project";

      for (const file of Array.from(files)) {
        const path = "/" + file.webkitRelativePath.split("/").slice(1).join("/");
        const parts = path.split("/").filter(Boolean);
        if (
          parts.some(
            (p) =>
              p.startsWith(".") ||
              ["node_modules", "dist", "build", "out", "coverage", "target"].includes(p)
          ) ||
          /(?:credential|private-key|service-account|id_rsa|\.pem$|\.key$)/i.test(path)
        ) {
          skipped++;
          continue;
        }
        if (
          !/\.(?:[cm]?[jt]sx?|json|html|css|s[ac]ss|less|vue|svelte|astro|mdx?|svg|txt|ya?ml|png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(
            path
          )
        ) {
          skipped++;
          continue;
        }
        size += file.size;
        if (size > 20 * 1024 * 1024 || file.size > 4 * 1024 * 1024 || ++count > 1000) {
          throw new Error("폴더 제한: 총 20MB, 파일당 4MB, 1,000개입니다.");
        }
        if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(path)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let raw = "";
          for (let i = 0; i < bytes.length; i += 8192) {
            raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          binary[path] = btoa(raw);
        } else {
          text[path] = (await file.text()).replace(/^\uFEFF/, "");
        }
      }

      setProject({
        source: {
          owner: "Local",
          repository: projectName,
          ref: "local",
          url: "",
        },
        framework: "AUTO",
        files: text,
        binaryFiles: binary,
        skippedFileCount: skipped,
      });
      setShowImport(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "폴더 읽기 실패");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const handleStartDemo = () => {
    setProject(demo);
    setShowImport(false);
    setError("");
  };

  if (!routeReady) {
    return <div className="editor-page-view" aria-busy="true"><Header activeNav="Editor" /></div>;
  }

  return (
    <div className="editor-page-view">
      {/* 1. Common POLAZU Header with Editor as active */}
      <Header activeNav="Editor" />

      {/* 2. Top Sub-Bar when Project is loaded */}
      {project && (
        <div className="editor-subbar">
          <div className="editor-subbar-info">
            <span className="editor-subbar-badge">Workspace</span>
            <span className="editor-subbar-sep">/</span>
            <strong className="editor-subbar-name">
              {project.source.repository || "새 프로젝트"}
            </strong>
            {project.source.ref && (
              <small className="editor-subbar-ref">{project.source.ref}</small>
            )}
          </div>
          <div className="editor-subbar-actions">
            <button
              type="button"
              className="editor-subbar-btn"
              onClick={() => setShowImport(!showImport)}
            >
              {showImport ? "✕ 창 닫기" : "＋ 다른 프로젝트 열기"}
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Body */}
      {studioMode !== "ui" && (!project || showImport) ? (
        <main className="editor-entry-container">
          {/* Header Title Section matching Convert & Upload */}
          <header className="editor-page-header">
            <span className="editor-page-eyebrow">POLAZU WEB STUDIO</span>
            <h1 className="editor-page-title">PROJECT &amp; CODE EDITOR</h1>
            <p className="editor-page-subtitle">
              GitHub 저장소나 로컬 프로젝트를 불러와 브라우저 실시간 캔버스에서 화면과 코드를 디자인하세요.
            </p>
          </header>

          {/* Import Workspace Panel */}
          <section className="editor-import-card" aria-label="프로젝트 불러오기">
            <div className="editor-import-card-header">
              <div className="editor-import-card-tag">GITHUB IMPORT</div>
              <h2 className="editor-import-card-title">저장소 불러오기</h2>
              <p className="editor-import-card-desc">
                공개 GitHub 저장소 URL을 입력하여 실행 가능한 웹 프로젝트를 즉시 분석하고 로드합니다.
              </p>
            </div>

            <form onSubmit={load} className="editor-github-form">
              <div className="editor-form-field">
                <label htmlFor="github-url">GitHub 저장소 URL</label>
                <input
                  id="github-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  required
                  className="editor-form-input"
                />
              </div>

              <div className="editor-form-field branch-field">
                <label htmlFor="github-branch">브랜치 (선택)</label>
                <input
                  id="github-branch"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main 또는 master"
                  className="editor-form-input"
                />
              </div>

              <button
                type="submit"
                className="editor-submit-btn"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <svg className="editor-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    불러오는 중...
                  </>
                ) : (
                  "프로젝트 불러오기"
                )}
              </button>
            </form>

            {error && <div className="editor-alert-error" role="alert">{error}</div>}

            <div className="editor-quickstart-divider">
              <span>또는 간편하게 시작하기</span>
            </div>

            {/* Quickstart Launch Options */}
            <div className="editor-quickstart-grid">
              <button
                type="button"
                className="editor-quick-btn"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <div className="editor-quick-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="editor-quick-text">
                  <strong>로컬 폴더 열기</strong>
                  <span>내 컴퓨터의 프로젝트 폴더를 직접 선택하여 브라우저에서 실행</span>
                </div>
              </button>

              <button
                type="button"
                className="editor-quick-btn highlight"
                disabled={busy}
                onClick={handleStartDemo}
              >
                <div className="editor-quick-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <div className="editor-quick-text">
                  <strong>데모 프로젝트로 시작</strong>
                  <span>별도 설정 없이 클릭 한 번으로 준비된 인터랙티브 웹 앱 체험</span>
                </div>
              </button>
            </div>

            <p className="editor-privacy-note">
              🔒 로컬 폴더는 브라우저 메모리 내에서만 안전하게 읽히며 외부 서버로 비밀키나 토큰이 전송되지 않습니다.
            </p>

            <input
              ref={input}
              type="file"
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              multiple
              hidden
              onChange={(e) => void local(e.target.files)}
            />
          </section>

          {/* 3 Step Features Guide */}
          <section className="editor-features-grid" aria-label="에디터 사용 단계">
            <div className="editor-feature-card">
              <div className="editor-feature-step">01</div>
              <h3>프로젝트 및 코드 로드</h3>
              <p>GitHub 저장소 URL 또는 로컬 폴더를 통해 프론트엔드 프로젝트를 즉시 불러옵니다.</p>
            </div>
            <div className="editor-feature-card">
              <div className="editor-feature-step">02</div>
              <h3>실시간 시각 디자인 편집</h3>
              <p>캔버스에서 직접 UI 요소를 클릭하고 폰트, 여백, 컬러, 레이아웃을 직관적으로 수정합니다.</p>
            </div>
            <div className="editor-feature-card">
              <div className="editor-feature-step">03</div>
              <h3>안전한 변경 내보내기</h3>
              <p>수정한 디자인 스타일과 Mock API 설정을 원클릭으로 내보내어 프로젝트에 바로 적용합니다.</p>
            </div>
          </section>
        </main>
      ) : (
        /* When project is running in studio runtime */
        <main className="editor-runtime-container">
          {studioMode === "ui" ? <SavedUiEditor /> : project ? <BrowserProjectRuntime
            key={JSON.stringify(project.source) + Object.keys(project.files).length}
            project={project}
          /> : null}
        </main>
      )}
    </div>
  );
}
