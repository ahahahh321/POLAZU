import type { CSSProperties } from "react";
import type { SavedItem } from "../data";

type SavedGridProps = { items: SavedItem[]; onRemove: (id: number) => void };

export default function SavedGrid({ items, onRemove }: SavedGridProps) {
  if (!items.length) return <div className="mypage-empty"><p>아직 저장한 컴포넌트가 없어요.</p><a href="/">컴포넌트 둘러보기</a></div>;

  return (
    <div className="mypage-saved-grid">
      {items.map((item) => (
        <article className="mypage-card" key={item.id}>
          <div className="mypage-card-preview" style={{ "--card-base": item.colors[0], "--card-accent": item.colors[1] } as CSSProperties}>
            <span className="mypage-card-ribbon" />
            <div className="mypage-card-ui"><b>Email address</b><div><i>hello@jiyoo.dev</i><em>Sign up</em></div></div>
          </div>
          <div className="mypage-card-meta"><div><small>{item.type}</small><h3>{item.title}</h3></div><button type="button" onClick={() => onRemove(item.id)} aria-label={`${item.title} 저장 해제`}>♡</button></div>
          <p>♥ {item.likes}<span>◉ {item.views}</span></p>
        </article>
      ))}
    </div>
  );
}
