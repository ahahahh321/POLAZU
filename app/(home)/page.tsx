"use client";

import Header from "@/components/header/Header";
import FeatureGrid from "./_components/FeatureGrid";
import CategoryBrowser from "./_components/CategoryBrowser";
import TrendingSection from "./_components/TrendingSection";
import { useHomeFilters } from "./_hooks/useHomeFilters";
import "./page.css";

// 홈 UI를 조합하고 훅의 데이터와 동작을 각 컴포넌트에 연결합니다.
export default function HomePage() {
  const { query, setQuery, category, setCategory, items, resetFilters } = useHomeFilters();

  return (
    <div className="main-view">
      <a href="#main-content" className="skip-link">본문으로 이동</a>
      <Header query={query} onSearch={setQuery} />
      <main id="main-content">
        {/* Tailwind className의 sr-only는 제목을 화면 낭독기에만 보여 줍니다. */}
        <h1 className="sr-only">tmp — Main Page</h1>
        <div className="main-hero" role="img" aria-label="메인 비주얼이 들어갈 프레임 영역" />
        <FeatureGrid />
        <CategoryBrowser
          items={items}
          selected={category}
          onSelect={setCategory}
          onReset={resetFilters}
        />
        <TrendingSection />
      </main>
    </div>
  );
}
