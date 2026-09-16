import Avatar from "@/components/avatar/Avatar";
import { categories, type Category, type ComponentItem } from "../data";

type CategoryBrowserProps = {
  items: ComponentItem[];
  selected: Category;
  onSelect: (category: Category) => void;
  onReset: () => void;
};

export default function CategoryBrowser({
  items, selected, onSelect, onReset,
}: CategoryBrowserProps) {
  return (
    <section id="browse" className="main-browse" aria-labelledby="browse-heading">
      <h2 id="browse-heading">Browse by Category</h2>
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
              <h3 className="sr-only">{item.title}</h3>
              <div className="main-author">
                <Avatar />
                <span>{item.author}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="main-empty">
          <p>표시할 샘플 컴포넌트가 없습니다.</p>
          <button type="button" onClick={onReset}>전체 컴포넌트 보기</button>
        </div>
      )}
    </section>
  );
}
