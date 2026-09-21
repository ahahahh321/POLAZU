"use client";

import Header from "@/components/header/Header";
import HeroSection from "./_components/HeroSection";
import FeatureGrid from "./_components/FeatureGrid";
import CategoryBrowser from "./_components/CategoryBrowser";
import TrendingSection from "./_components/TrendingSection";
import { useHomeFilters } from "./_hooks/useHomeFilters";
import "./page.css";

// 홈 UI를 조합하고 훅의 데이터와 동작을 각 컴포넌트에 연결합니다.
export default function HomePage() {
  const {
    query, setQuery, category, setCategory, items, savedIds, toggleSaved, resetFilters,
  } = useHomeFilters();

  return (
    <div className="main-view">
      <a href="#main-content" className="skip-link">본문으로 이동</a>
      <Header activeNav="Explore" query={query} onSearch={setQuery} />
      <main id="main-content">
        <HeroSection />
        <FeatureGrid />
        <CategoryBrowser
          items={items}
          selected={category}
          savedIds={savedIds}
          onSelect={setCategory}
          onToggleSaved={toggleSaved}
          onReset={resetFilters}
        />
        <TrendingSection />
      </main>
    </div>
  );
}
