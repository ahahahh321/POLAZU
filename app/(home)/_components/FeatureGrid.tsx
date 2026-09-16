import { features } from "../data";

export default function FeatureGrid() {
  return (
    <section className="main-features" aria-label="플랫폼 주요 기능">
      {features.map((feature) => (
        <article key={feature.title} className="main-feature">
          <h2>{feature.title}</h2>
          <p>{feature.description}</p>
        </article>
      ))}
    </section>
  );
}
