"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/header/Header";
import {
  SUPPORTED_LANGUAGES,
  SAMPLE_CODES,
  convertCode,
  type SupportedLanguage,
} from "./_lib/codeConverter";
import "./convert.css";

export default function ConvertPage() {
  const [sourceLang, setSourceLang] = useState<SupportedLanguage>("python");
  const [targetLang, setTargetLang] = useState<SupportedLanguage>("java");
  const [sourceCode, setSourceCode] = useState<string>(
    SAMPLE_CODES.hello.python
  );
  const [convertedCode, setConvertedCode] = useState<string>("");
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeSample, setActiveSample] = useState<string>("hello");

  const handleConvert = useCallback(() => {
    setIsConverting(true);
    // Add realistic conversion transition
    setTimeout(() => {
      const result = convertCode(sourceCode, sourceLang, targetLang);
      setConvertedCode(result);
      setIsConverting(false);
    }, 180);
  }, [sourceCode, sourceLang, targetLang]);

  // Initial conversion on mount or sample load
  useEffect(() => {
    handleConvert();
  }, [handleConvert]);

  // Swap source and target languages
  const handleSwap = () => {
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    const prevConverted = convertedCode;

    setSourceLang(prevTarget);
    setTargetLang(prevSource);

    if (prevConverted.trim()) {
      setSourceCode(prevConverted);
      setConvertedCode(convertCode(prevConverted, prevTarget, prevSource));
    }
  };

  // Load sample code
  const handleLoadSample = (sampleKey: "hello" | "fibonacci" | "evenOdd") => {
    setActiveSample(sampleKey);
    const sample = SAMPLE_CODES[sampleKey];
    if (sample) {
      setSourceCode(sample[sourceLang]);
      setConvertedCode(sample[targetLang]);
    }
  };

  // When source language dropdown changes
  const handleSourceLangChange = (lang: SupportedLanguage) => {
    setSourceLang(lang);
    if (activeSample && SAMPLE_CODES[activeSample]) {
      setSourceCode(SAMPLE_CODES[activeSample][lang]);
    }
  };

  // When target language dropdown changes
  const handleTargetLangChange = (lang: SupportedLanguage) => {
    setTargetLang(lang);
    if (activeSample && SAMPLE_CODES[activeSample]) {
      setConvertedCode(SAMPLE_CODES[activeSample][lang]);
    } else {
      setConvertedCode(convertCode(sourceCode, sourceLang, lang));
    }
  };

  // Copy output to clipboard
  const handleCopy = async () => {
    if (!convertedCode) return;
    try {
      await navigator.clipboard.writeText(convertedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = convertedCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download converted code as file
  const handleDownload = () => {
    if (!convertedCode) return;
    const targetObj = SUPPORTED_LANGUAGES.find((l) => l.id === targetLang);
    const ext = targetObj?.ext || "txt";
    const blob = new Blob([convertedCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polazu_converted.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear source code
  const handleClear = () => {
    setSourceCode("");
    setConvertedCode("");
    setActiveSample("");
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSourceCode(text);
        setActiveSample("");
      }
    } catch {
      // Ignore if permission denied
    }
  };

  const targetExt = SUPPORTED_LANGUAGES.find((l) => l.id === targetLang)?.ext || "txt";
  const sourceLines = sourceCode ? sourceCode.split("\n").length : 0;
  const targetLines = convertedCode ? convertedCode.split("\n").length : 0;

  return (
    <div className="convert-view">
      <Header activeNav="Convert" />

      <main className="convert-container">
        <header className="convert-header">
          <span className="convert-eyebrow">POLAZU MULTI-LANGUAGE ENGINE</span>
          <h1 className="convert-title">CODE CONVERTER</h1>
          <p className="convert-subtitle">
            C, Java, Python, C++, TypeScript, Go 등 원하는 언어로 실시간 코드를 변환하세요.
          </p>
        </header>

        {/* Toolbar & Controls */}
        <section className="convert-toolbar" aria-label="언어 변환 도구 모음">
          <div className="convert-lang-group">
            <div className="convert-select-wrapper">
              <label htmlFor="source-lang" className="convert-select-label">
                원본 언어:
              </label>
              <select
                id="source-lang"
                className="convert-select"
                value={sourceLang}
                onChange={(e) => handleSourceLangChange(e.target.value as SupportedLanguage)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.badge})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="convert-swap-btn"
              onClick={handleSwap}
              title="언어 전환 (Swap)"
              aria-label="언어 전환"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
            </button>

            <div className="convert-select-wrapper">
              <label htmlFor="target-lang" className="convert-select-label">
                대상 언어:
              </label>
              <select
                id="target-lang"
                className="convert-select"
                value={targetLang}
                onChange={(e) => handleTargetLangChange(e.target.value as SupportedLanguage)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.badge})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="convert-actions">
            <button
              type="button"
              className={`convert-sample-btn ${activeSample === "hello" ? "active" : ""}`}
              onClick={() => handleLoadSample("hello")}
            >
              환영 예제
            </button>
            <button
              type="button"
              className={`convert-sample-btn ${activeSample === "fibonacci" ? "active" : ""}`}
              onClick={() => handleLoadSample("fibonacci")}
            >
              피보나치 수열
            </button>
            <button
              type="button"
              className={`convert-sample-btn ${activeSample === "evenOdd" ? "active" : ""}`}
              onClick={() => handleLoadSample("evenOdd")}
            >
              짝수/홀수
            </button>

            <button
              type="button"
              className="convert-run-btn"
              onClick={handleConvert}
              disabled={isConverting || !sourceCode.trim()}
            >
              {isConverting ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="spin-animation"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  변환 중...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  변환하기
                </>
              )}
            </button>
          </div>
        </section>

        {/* Dual Editor Grid */}
        <section className="convert-grid" aria-label="코드 변환 에디터">
          {/* Source Code Panel */}
          <div className="convert-panel">
            <div className="convert-panel-header">
              <div className="convert-panel-title">
                <span>입력 코드 ({sourceLang.toUpperCase()})</span>
                <span className="convert-panel-tag">{sourceLines} lines</span>
              </div>
              <div className="convert-panel-tools">
                <button
                  type="button"
                  className="convert-tool-btn"
                  onClick={handlePaste}
                  title="클립보드에서 붙여넣기"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  붙여넣기
                </button>
                <button
                  type="button"
                  className="convert-tool-btn"
                  onClick={handleClear}
                  title="코드 지우기"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                  지우기
                </button>
              </div>
            </div>
            <div className="convert-editor-wrap">
              <textarea
                className="convert-textarea"
                placeholder="// 변환할 코드를 입력하거나 붙여넣으세요..."
                value={sourceCode}
                onChange={(e) => {
                  setSourceCode(e.target.value);
                  setActiveSample("");
                }}
                spellCheck={false}
                aria-label="원본 코드 입력란"
              />
            </div>
          </div>

          {/* Target Code Panel */}
          <div className="convert-panel">
            <div className="convert-panel-header">
              <div className="convert-panel-title">
                <span>변환 결과 ({targetLang.toUpperCase()})</span>
                {convertedCode ? (
                  <span className="convert-panel-tag">{targetLines} lines</span>
                ) : null}
              </div>
              <div className="convert-panel-tools">
                <button
                  type="button"
                  className="convert-tool-btn"
                  onClick={handleCopy}
                  disabled={!convertedCode}
                  title="클립보드로 복사"
                >
                  {copied ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <strong style={{ color: "#22c55e" }}>복사됨!</strong>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      복사
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="convert-tool-btn"
                  onClick={handleDownload}
                  disabled={!convertedCode}
                  title={`${targetExt.toUpperCase()} 파일로 다운로드`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  .{targetExt} 저장
                </button>
              </div>
            </div>

            <div className="convert-editor-wrap">
              {convertedCode ? (
                <pre className="convert-output-code">
                  <code>{convertedCode}</code>
                </pre>
              ) : (
                <div className="convert-empty-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <p>코드를 입력하고 &apos;변환하기&apos; 버튼을 누르면 여기에 변환 결과가 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
