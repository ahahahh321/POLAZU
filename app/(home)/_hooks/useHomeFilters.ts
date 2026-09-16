"use client";

import { useState } from "react";
import { componentItems, type Category } from "../data";

export function useHomeFilters() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All Components");
  const keyword = query.trim().toLowerCase();
  const items = componentItems.filter((item) => {
    const matchesCategory = category === "All Components" || item.category === category;
    const matchesSearch = (item.title + " " + item.author).toLowerCase().includes(keyword);
    return matchesCategory && matchesSearch;
  });

  function resetFilters() {
    setQuery("");
    setCategory("All Components");
  }

  return { query, setQuery, category, setCategory, items, resetFilters };
}
