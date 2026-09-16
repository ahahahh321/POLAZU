import "./avatar.css";

// 여러 페이지에서 재사용하는 공통 UI입니다.
export default function Avatar() {
  return (
    <svg className="common-avatar" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#ededed" />
      <circle cx="16" cy="11" r="6" fill="#909090" />
      <path d="M4 29c0-8 5-12 12-12s12 4 12 12" fill="#909090" />
    </svg>
  );
}
