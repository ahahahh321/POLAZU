"use client";

import Link from "next/link";
import BrandLogo from "@/components/header/BrandLogo";
import { useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { PolazuButton, type PolazuButtonProps } from "./PolazuButton";

const variants = ["primary", "secondary", "neutral"] as const;
const sizes = ["sm", "md", "lg"] as const;
const states = ["Default", "Hover", "Pressed", "Focus", "Disabled"] as const;

export default function ButtonPlayground({ source, stylesheet }: { source: string; stylesheet: string }) {
  const { theme } = useTheme();
  const [variant, setVariant] = useState<NonNullable<PolazuButtonProps["variant"]>>("primary");
  const [size, setSize] = useState<NonNullable<PolazuButtonProps["size"]>>("md");
  const [disabled, setDisabled] = useState(false);
  const [clicks, setClicks] = useState(0);

  return <div className="pz-home" data-home-theme={theme}>
    <header className="pz-header"><div className="pz-shell pz-header-row">
      <BrandLogo className="pz-logo" /><Link className="pz-pill" href="/community/">레퍼런스 둘러보기</Link>
    </div></header>
    <main className="pz-shell pz-lab">
      <p className="pz-lab-kicker">COMPONENT PLAYGROUND</p>
      <h1>Button</h1>
      <p>크기와 상태를 비교하고 실제 버튼을 눌러보세요.</p>
      <section className="pz-lab-panel" aria-labelledby="interactive">
        <h2 id="interactive">직접 테스트</h2>
        <div className="pz-lab-controls">
          <label>종류 <select value={variant} onChange={(event) => setVariant(event.target.value as typeof variant)}>
            {variants.map((value) => <option key={value}>{value}</option>)}
          </select></label>
          <label>크기 <select value={size} onChange={(event) => setSize(event.target.value as typeof size)}>
            {sizes.map((value) => <option key={value}>{value}</option>)}
          </select></label>
          <label><input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} /> 비활성</label>
        </div>
        <PolazuButton variant={variant} size={size} disabled={disabled} onClick={() => setClicks((value) => value + 1)}>Button</PolazuButton>
        <span className="pz-lab-count" role="status">클릭 {clicks}회</span>
      </section>
      <section className="pz-lab-panel" aria-labelledby="matrix">
        <h2 id="matrix">상태 한눈에 보기</h2>
        <p>마우스·키보드 상태를 고정해 나란히 표시한 비교표입니다.</p>
        <div className="pz-lab-matrix">{sizes.map((entry, index) => <section key={entry} className="pz-lab-size">
          <h3>{entry.toUpperCase()} · {[35, 40, 55][index]}px</h3>
          {variants.map((kind) => <div key={kind} className="pz-lab-variant">
            <h4>{kind}</h4>
            <div>{states.map((state) => <div key={state} className="pz-lab-sample" data-preview={state}>
              <PolazuButton variant={kind} size={entry} disabled={state === "Disabled"} tabIndex={-1}>Button</PolazuButton>
              <small>{state}</small>
            </div>)}</div>
          </div>)}
        </section>)}</div>
      </section>
      <section className="pz-lab-panel" aria-labelledby="export">
        <h2 id="export">React로 가져가기</h2>
        <p>두 파일을 같은 폴더에 넣고 React + TypeScript 프로젝트에서 불러오세요.</p>
        <div className="pz-lab-downloads">
          <a className="pz-primary" download="PolazuButton.tsx" href={`data:text/plain;charset=utf-8,${encodeURIComponent(source)}`}>PolazuButton.tsx</a>
          <a className="pz-secondary" download="polazu-button.css" href={`data:text/css;charset=utf-8,${encodeURIComponent(stylesheet)}`}>polazu-button.css</a>
        </div>
        <pre>{'import { PolazuButton } from "./PolazuButton";\n\n<PolazuButton variant="primary" size="md" onClick={handleClick}>\n  계속하기\n</PolazuButton>'}</pre>
      </section>
    </main>
  </div>;
}
