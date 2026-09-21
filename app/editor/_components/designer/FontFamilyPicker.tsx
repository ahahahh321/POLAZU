"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./InspectorControls.module.css";

const COMMON_FONTS = ["Noto Sans KR", "Pretendard", "SUIT", "Spoqa Han Sans Neo", "Nanum Gothic", "Nanum Myeongjo", "IBM Plex Sans KR", "Arial", "Helvetica", "Inter", "Roboto", "Montserrat", "Poppins", "Georgia", "Times New Roman", "Courier New", "system-ui"];

export default function FontFamilyPicker({ value = "", fonts = [], onChange, disabled = false }: { value?: string; fonts?: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const suppressFocusOpen = useRef(false);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const primary = value.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const options = useMemo(() => [...new Set([...fonts, ...COMMON_FONTS])].filter((font) => font.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [fonts, query]);
  const custom = query.trim() && !options.some((font) => font.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const choices = custom ? [...options, query.trim()] : options;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open) root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const focusInput = () => {
    suppressFocusOpen.current = true;
    input.current?.focus();
    suppressFocusOpen.current = false;
  };
  const choose = (font: string) => { onChange(font); setOpen(false); focusInput(); };
  return <div className={styles.fontRoot} ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className={`designer-value-field ${styles.fontControl}`}>
      <span>Font</span>
      <input ref={input} role="combobox" aria-label="폰트 검색 및 선택" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && choices.length ? `${listId}-${active}` : undefined}
        value={open ? query : primary} placeholder={open ? "폰트 이름 검색…" : "폰트를 선택하세요"} disabled={disabled} spellCheck={false}
        onFocus={() => { if (!open && !suppressFocusOpen.current) { setQuery(""); setActive(0); setOpen(true); } }}
        onClick={() => { if (!open) { setQuery(""); setActive(0); setOpen(true); } }}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((current) => Math.max(0, Math.min(choices.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))); }
          if (event.key === "Enter" && open && choices[active]) { event.preventDefault(); choose(choices[active]); }
        }}/>
      <button type="button" aria-label={open ? "폰트 목록 닫기" : "폰트 목록 열기"} aria-expanded={open} aria-controls={listId} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { const nextOpen = !open; setQuery(""); setActive(0); setOpen(nextOpen); focusInput(); }}>⌄</button>
    </div>
    {open && <div className={styles.fontPopover}>
      <div className={styles.fontHeading}>{query ? `${choices.length}개 결과` : "프로젝트 및 기본 폰트"}</div>
      <div className={styles.fontList} id={listId} role="listbox" aria-label="사용할 폰트">
        {choices.map((font, index) => <button key={font} id={`${listId}-${index}`} role="option" type="button" tabIndex={-1} aria-selected={active === index} className={styles.fontOption} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(font)}>
          <span style={{ fontFamily: font }}>{font}</span><small>{custom && index === choices.length - 1 ? "직접 입력" : fonts.includes(font) ? "프로젝트" : "기본"}</small>{font === primary && <i>✓</i>}
        </button>)}
      </div>
      <p>↑↓ 탐색 · Enter 선택 · Esc 닫기<br/>프로젝트에 없는 웹폰트는 별도로 불러와야 표시됩니다.</p>
    </div>}
  </div>;
}
