import { workflowSteps } from "../data";

export default function TrendingSection() {
  return (
    <section className="main-workflow" aria-labelledby="workflow-heading">
      <div className="main-section-heading">
        <div>
          <span>ONE CONNECTED FLOW</span>
          <h2 id="workflow-heading">UI를 찾는 순간부터 코드 반영까지</h2>
        </div>
        <p>화면을 꾸미는 데서 끝나지 않고 실제 동작을 확인하는 흐름으로 이어집니다.</p>
      </div>
      <ol className="main-workflow-list">
        {workflowSteps.map((step) => (
          <li key={step.number}>
            <span>{step.number}</span>
            <div><h3>{step.title}</h3><p>{step.description}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
