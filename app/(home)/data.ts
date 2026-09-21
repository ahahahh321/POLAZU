export const startOptions = [
  {
    eyebrow: "TRY IT NOW",
    title: "샘플 프로젝트",
    description: "저장소 없이 UI 선택, 수정, 미리보기를 먼저 체험합니다.",
    href: "/editor/",
    action: "샘플 열기",
  },
  {
    eyebrow: "START FROM UI",
    title: "저장한 UI 편집",
    description: "마이페이지에 저장한 컴포넌트를 불러와 빠르게 수정합니다.",
    href: "/editor/ui/",
    action: "UI Editor 열기",
  },
  {
    eyebrow: "START FROM CODE",
    title: "기존 프로젝트",
    description: "GitHub 또는 로컬 프로젝트를 가져와 실행하고 편집합니다.",
    href: "/editor/?mode=project",
    action: "Project Editor 열기",
  },
];

export const categories = [
  "All Components", "Buttons", "Forms", "Sections", "Pages", "Templates",
] as const;

// 허용하는 카테고리를 타입으로 정해 오타를 방지합니다.
export type Category = (typeof categories)[number];
export type ComponentItem = {
  id: number;
  title: string;
  category: Category;
  author: string;
  description: string;
  tags: string[];
  accent: string;
};

// 실제 커뮤니티 API 계약 전까지 사용하는 홈 전용 샘플 데이터입니다.
export const componentItems: ComponentItem[] = [
  { id: 1, title: "Newsletter signup", category: "Forms", author: "sara Chen", description: "이메일 수집을 위한 반응형 가입 폼", tags: ["React", "Responsive"], accent: "#ff4d0a" },
  { id: 2, title: "Command search", category: "Forms", author: "min park", description: "키보드 탐색을 지원하는 검색 패널", tags: ["Search", "A11y"], accent: "#7c5cff" },
  { id: 3, title: "Primary actions", category: "Buttons", author: "jiyoo choi", description: "상태별 버튼과 로딩 인터랙션", tags: ["States", "Tokens"], accent: "#ffb800" },
  { id: 4, title: "Product hero", category: "Sections", author: "sara Chen", description: "제품 소개와 CTA가 포함된 히어로", tags: ["Landing", "Hero"], accent: "#23c483" },
  { id: 5, title: "Analytics overview", category: "Pages", author: "min park", description: "핵심 지표와 활동을 보여주는 페이지", tags: ["Dashboard", "Charts"], accent: "#3f8cff" },
  { id: 6, title: "Starter workspace", category: "Templates", author: "POLAZU", description: "에디터 기능을 바로 확인하는 시작 템플릿", tags: ["Starter", "Editor"], accent: "#ff4d0a" },
];

export const workflowSteps = [
  { number: "01", title: "가져오기", description: "샘플, 저장한 UI, GitHub 프로젝트 중 하나를 선택합니다." },
  { number: "02", title: "시각 편집", description: "캔버스에서 요소를 선택하고 속성과 상태를 수정합니다." },
  { number: "03", title: "실제 동작 확인", description: "Preview에서 입력, 클릭, 드래그와 화면 상태를 검증합니다." },
  { number: "04", title: "변경 반영", description: "변경 내용을 비교하고 코드 또는 프로젝트로 이어갑니다." },
];
