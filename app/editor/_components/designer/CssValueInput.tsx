"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { normalizeCssScalar, stepCssScalar } from "../../_lib/inspector-values";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value?: string;
  onChange: (value: string) => void;
  defaultUnit?: string;
  numeric?: boolean;
  minimum?: number;
  maximum?: number;
  increment?: number;
};

export default function CssValueInput({ value = "", onChange, defaultUnit = "", numeric = false, minimum, maximum, increment, ...inputProps }: Props) {
  const [input, setInput] = useState(value);
  const focused = useRef(false);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (!focused.current || value !== lastEmitted.current) setInput(value);
  }, [value]);
  const emit = (next: string) => {
    lastEmitted.current = next;
    onChange(next);
  };
  return <input {...inputProps} value={input} spellCheck={false}
    title={numeric ? "↑↓ 값 조절 · Shift 10배 · Alt 정밀 조절" : inputProps.title}
    onFocus={(event) => { focused.current = true; inputProps.onFocus?.(event); }}
    onChange={(event) => {
      const next = event.target.value;
      setInput(next);
      if (!numeric || !/^[-+.]$/.test(next.trim())) emit(numeric ? normalizeCssScalar(next, defaultUnit) : next);
    }}
    onBlur={(event) => {
      focused.current = false;
      const normalized = numeric ? normalizeCssScalar(input, defaultUnit) : input;
      setInput(normalized);
      if (normalized !== value && !/^[-+.]$/.test(normalized)) emit(normalized);
      inputProps.onBlur?.(event);
    }}
    onKeyDown={(event) => {
      // Keep canvas shortcuts from moving or deleting an element while a field is focused.
      event.stopPropagation();
      if (numeric && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const next = stepCssScalar(input, event.key === "ArrowUp" ? 1 : -1, { defaultUnit, shift: event.shiftKey, alt: event.altKey, min: minimum, max: maximum, step: increment });
        if (next !== null) { event.preventDefault(); setInput(next); emit(next); }
      }
      if (event.key === "Enter") event.currentTarget.blur();
      inputProps.onKeyDown?.(event);
    }}/>
}
