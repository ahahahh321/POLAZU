"use client";

import Header from "@/components/header/Header";
import FeatureGrid from "../(home)/_components/FeatureGrid";
import CategoryBrowser from "../(home)/_components/CategoryBrowser";
import TrendingSection from "../(home)/_components/TrendingSection";
import { useHomeFilters } from "../(home)/_hooks/useHomeFilters";
import "../(home)/page.css";

export default function ExplorePage() {
  const { query, setQuery, category, setCategory, items, resetFilters } = useHomeFilters();
  return <div className="main-view"><Header query={query} onSearch={setQuery} activeNav="Explore"/><main id="main-content"><h1 className="sr-only">POLAZU Explore</h1><div className="main-hero" role="img" aria-label="메인 비주얼"/><FeatureGrid/><CategoryBrowser items={items} selected={category} onSelect={setCategory} onReset={resetFilters}/><TrendingSection/></main></div>;
}
