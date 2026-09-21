"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DesignToken } from "../../_lib/design-tokens";
import {
  createTokenReference,
  getBindableDesignTokens,
  getTokenNameFromReference,
  type TokenBindingTarget,
} from "../../_lib/token-bindings";
import DesignerIcon from "./DesignerIcon";
import styles from "./TokenBindingField.module.css";
import CssValueInput from "./CssValueInput";
import { cssColorToHex } from "../../_lib/inspector-values";

type Props = {
  label: string;
  value?: string;
  placeholder?: string;
  property: TokenBindingTarget;
  tokens: readonly DesignToken[];
  onChange: (value: string) => void;
  color?: boolean;
  disabled?: boolean;
};

export default function TokenBindingField({
  label,
  value,
  placeholder,
  property,
  tokens,
  onChange,
  color = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const activeName = getTokenNameFromReference(value);
  const compatibleTokens = useMemo(() => getBindableDesignTokens(tokens, property), [tokens, property]);
  const filteredTokens = useMemo(
    () => getBindableDesignTokens(tokens, property, query),
    [tokens, property, query],
  );
  const activeToken = activeName ? compatibleTokens.find((token) => token.name === activeName) : undefined;
  const colorValue = cssColorToHex(activeToken?.value ?? value);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const togglePicker = () => {
    if (disabled) return;
    setQuery("");
    setOpen((current) => !current);
  };

  const bindToken = (token: DesignToken) => {
    const reference = createTokenReference(token.name);
    if (!reference) return;
    onChange(reference);
    setOpen(false);
  };

  return <div className={`${styles.root}${color ? ` ${styles.color}` : ""}`} ref={rootRef} data-token-bound={activeName ? "true" : undefined}>
    <div className={`designer-value-field ${styles.control}`}>
      <span id={labelId}>{label}</span>
      {color && <input className={styles.swatch} type="color" aria-label={`${label} 색 선택`} value={colorValue} disabled={disabled} onChange={(event) => onChange(event.target.value)}/>}
      <CssValueInput className={styles.value} aria-labelledby={labelId} value={value} placeholder={placeholder} disabled={disabled} onChange={onChange} numeric={!color} defaultUnit={color ? "" : "px"} minimum={color ? undefined : 0}/>
      <button
        className={`${styles.trigger}${activeName ? ` ${styles.active}` : ""}`}
        type="button"
        aria-label={`${label} 디자인 토큰 선택`}
        aria-expanded={open}
        title={activeName ? `${activeName}에 연결됨` : "프로젝트 디자인 토큰에 연결"}
        disabled={disabled}
        onClick={togglePicker}
      ><DesignerIcon name="palette"/></button>
    </div>

    {open && <div className={styles.popover} role="dialog" aria-label={`${label} 디자인 토큰`}>
      <header className={styles.header}>
        <div><DesignerIcon name="link"/><strong>프로젝트 토큰</strong><small>{compatibleTokens.length}</small></div>
        <button type="button" aria-label="토큰 선택 닫기" onClick={() => setOpen(false)}>×</button>
      </header>
      <label className={styles.search}>
        <DesignerIcon name="search"/>
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 값 또는 파일 검색" spellCheck={false}/>
      </label>
      <div className={styles.list}>
        {filteredTokens.map((token) => <button
          className={`${styles.token}${activeName === token.name ? ` ${styles.selected}` : ""}`}
          type="button"
          key={token.name}
          onClick={() => bindToken(token)}
          title={`${token.path}:${token.line}`}
        >
          {color && <i className={styles.tokenSwatch} style={{ backgroundColor: token.value }}/>} 
          <span><strong>{token.name}</strong><small>{token.value}</small></span>
          {activeName === token.name ? <DesignerIcon name="check"/> : <em>{token.path.split("/").pop()}</em>}
        </button>)}
        {!filteredTokens.length && <div className={styles.empty}>
          <DesignerIcon name="palette"/>
          <span>{compatibleTokens.length ? "검색 결과가 없습니다." : "이 필드에 맞는 CSS 변수가 없습니다."}</span>
          <small>프로젝트 CSS의 기존 변수가 여기에 표시됩니다.</small>
        </div>}
      </div>
      {activeName && <footer className={styles.footer}><span>현재 연결</span><code>{activeName}</code></footer>}
    </div>}
  </div>;
}
