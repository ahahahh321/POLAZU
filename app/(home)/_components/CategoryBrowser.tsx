import Avatar from "@/components/avatar/Avatar";
import type { CSSProperties } from "react";
import { categories, type Category, type ComponentItem } from "../data";

type CategoryBrowserProps = {
  items: ComponentItem[];
  selected: Category;
  savedIds: number[];
  onSelect: (category: Category) => void;
  onToggleSaved: (id: number) => void;
  onReset: () => void;
};

export default function CategoryBrowser({
  items, selected, savedIds, onSelect, onToggleSaved, onReset,
}: CategoryBrowserProps) {
  return (
    <section id="browse" className="main-browse" aria-labelledby="browse-heading">
      <h2 id="browse-heading">Browse by Category</h2>
      <p className="main-browse-copy">컴포넌트를 미리 확인하고 저장한 뒤 UI Editor에서 수정할 수 있습니다.</p>
      <nav className="main-categories" aria-label="컴포넌트 카테고리">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={selected === category}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      <span className="sr-only" aria-live="polite">{items.length}개의 컴포넌트</span>
      {items.length > 0 ? (
        <div className="main-component-grid">
          {/* map으로 같은 모양의 카드를 데이터 개수만큼 만듭니다. */}
          {items.map((item) => (
            <article className="main-component-card" key={item.id} aria-label={item.title}>
              <div className="main-component-preview" style={{ "--card-accent": item.accent } as CSSProperties}>
                <span>{item.category}</span>
                <div className="main-preview-window"><i /><i /><i /></div>
              </div>
              <div className="main-component-info">
                <div className="main-component-title-row">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${item.title} ${savedIds.includes(item.id) ? "저장 취소" : "임시 저장"}`}
                    aria-pressed={savedIds.includes(item.id)}
                    onClick={() => onToggleSaved(item.id)}
                  >
                    {savedIds.includes(item.id) ? "♥" : "♡"}
                  </button>
                </div>
                <div className="main-component-meta">
                  <div className="main-author"><Avatar /><span>{item.author}</span></div>
                  <div className="main-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="main-empty">
          <p>검색 조건에 맞는 컴포넌트가 없습니다.</p>
          <button type="button" onClick={onReset}>전체 컴포넌트 보기</button>
        </div>
      )}
    </section>
  );
}
