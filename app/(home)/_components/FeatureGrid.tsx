import Link from "next/link";
import { startOptions } from "../data";

export default function FeatureGrid() {
  return (
    <section className="main-start" aria-labelledby="start-heading">
      <div className="main-section-heading">
        <div>
          <span>START A PROJECT</span>
          <h2 id="start-heading">어디서 시작하든 같은 편집 경험</h2>
        </div>
        <p>샘플로 먼저 확인하거나, 저장한 UI와 기존 코드를 바로 이어서 작업하세요.</p>
      </div>
      <div className="main-start-grid">
        {startOptions.map((option, index) => (
          <article key={option.title} className="main-start-card">
            <span className="main-start-index">0{index + 1}</span>
            <p className="main-start-eyebrow">{option.eyebrow}</p>
            <h3>{option.title}</h3>
            <p className="main-start-description">{option.description}</p>
            <Link href={option.href}>{option.action}<span aria-hidden="true">↗</span></Link>
          </article>
        ))}
      </div>
    </section>
  );
}
