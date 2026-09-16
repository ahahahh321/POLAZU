export default function TrendingSection() {
  return (
    <section className="main-trending" aria-labelledby="trending-heading">
      <h2 id="trending-heading">Tranding This Week</h2>
      <p className="sr-only">인기 컴포넌트가 들어갈 프레임 영역입니다.</p>
      {/* 아직 슬라이더 기능은 없는 화면 뼈대입니다. */}
      <div className="main-trending-track" aria-hidden="true">
        <div /><div /><div /><div /><div /><div /><div />
      </div>
    </section>
  );
}
