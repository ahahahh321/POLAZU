export const features = [
  { title: "Live Preview", description: "see and interact with components before you copy" },
  { title: "Stack Conversion", description: "instantly convert code between frameworks and languages" },
  { title: "Visual Remix", description: "customize components visually and export the code." },
  { title: "Ai Prompt Export", description: "Generate detailed prompts to recreate or extend components with Ai." },
  { title: "UX Logic", description: "customize components visually and export the code." },
];

export const categories = [
  "All Components", "Modals", "Dashboards", "Cards", "Layouts", "Feedback",
  "E-commerce", "Tables", "Navigation", "Buttons", "Marketing", "Forms",
] as const;

// 허용하는 카테고리를 타입으로 정해 오타를 방지합니다.
export type Category = (typeof categories)[number];
export type ComponentItem = {
  id: number;
  title: string;
  category: Category;
  author: string;
};

// 홈 페이지에서만 사용하는 가짜 데이터이므로 해당 페이지 옆에서 관리합니다.
export const componentItems: ComponentItem[] = [
  { id: 1, title: "Modal component", category: "Modals", author: "sara Chen" },
  { id: 2, title: "Dashboard component", category: "Dashboards", author: "sara Chen" },
  { id: 3, title: "Card component", category: "Cards", author: "sara Chen" },
  { id: 4, title: "Layout component", category: "Layouts", author: "sara Chen" },
];
