import "./avatar.css";

// 여러 페이지에서 재사용하는 공통 UI입니다.
export default function Avatar() {
  return (
    <svg className="common-avatar" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#ededed" />
      <circle cx="16" cy="11.5" r="4.5" fill="#909090" />
      <path d="M8 25.5c0-4.2 3.6-7 8-7s8 2.8 8 7c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5z" fill="#909090" />
    </svg>
  );
}
