export type EditableUi = {
  id: number;
  name: string;
  type: string;
  background: string;
  textColor: string;
  accent: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  padding: number;
  shadow: number;
  eyebrow: string;
  eyebrowColor: string;
  eyebrowSize: number;
  heading: string;
  headingColor: string;
  headingSize: number;
  label: string;
  labelColor: string;
  labelSize: number;
  placeholder: string;
  inputBackground: string;
  inputTextColor: string;
  inputBorder: string;
  inputRadius: number;
  inputHeight: number;
  buttonText: string;
  buttonTextColor: string;
  buttonTextSize: number;
  buttonPaddingX: number;
  buttonPaddingY: number;
  buttonRadius: number;
};

export const savedUiSeed: EditableUi[] = [
  {
    id: 1,
    name: "Sign in card",
    type: "Form",
    background: "#ffffff",
    textColor: "#111827",
    accent: "#2563eb",
    borderColor: "#dbe3ef",
    borderWidth: 1,
    radius: 20,
    padding: 32,
    shadow: 16,
    eyebrow: "WELCOME BACK",
    eyebrowColor: "#2563eb",
    eyebrowSize: 12,
    heading: "프로젝트 작업 공간에 로그인하세요",
    headingColor: "#111827",
    headingSize: 30,
    label: "이메일",
    labelColor: "#374151",
    labelSize: 14,
    placeholder: "name@example.com",
    inputBackground: "#f8fafc",
    inputTextColor: "#111827",
    inputBorder: "#cbd5e1",
    inputRadius: 10,
    inputHeight: 46,
    buttonText: "로그인",
    buttonTextColor: "#ffffff",
    buttonTextSize: 15,
    buttonPaddingX: 22,
    buttonPaddingY: 12,
    buttonRadius: 10,
  },
  {
    id: 2,
    name: "Project invite",
    type: "Dialog",
    background: "#0f172a",
    textColor: "#e2e8f0",
    accent: "#7c3aed",
    borderColor: "#334155",
    borderWidth: 1,
    radius: 24,
    padding: 36,
    shadow: 24,
    eyebrow: "TEAM COLLABORATION",
    eyebrowColor: "#c4b5fd",
    eyebrowSize: 12,
    heading: "팀원을 프로젝트에 초대합니다",
    headingColor: "#f8fafc",
    headingSize: 28,
    label: "팀원 이메일",
    labelColor: "#cbd5e1",
    labelSize: 14,
    placeholder: "designer@example.com",
    inputBackground: "#111827",
    inputTextColor: "#f8fafc",
    inputBorder: "#475569",
    inputRadius: 12,
    inputHeight: 48,
    buttonText: "초대 보내기",
    buttonTextColor: "#ffffff",
    buttonTextSize: 15,
    buttonPaddingX: 24,
    buttonPaddingY: 12,
    buttonRadius: 12,
  },
  {
    id: 3,
    name: "Empty state",
    type: "Feedback",
    background: "#fff7ed",
    textColor: "#431407",
    accent: "#ea580c",
    borderColor: "#fed7aa",
    borderWidth: 1,
    radius: 18,
    padding: 30,
    shadow: 10,
    eyebrow: "NO PROJECTS YET",
    eyebrowColor: "#c2410c",
    eyebrowSize: 11,
    heading: "첫 번째 프로젝트를 가져오세요",
    headingColor: "#431407",
    headingSize: 27,
    label: "저장소 주소",
    labelColor: "#7c2d12",
    labelSize: 14,
    placeholder: "https://github.com/org/repository",
    inputBackground: "#ffffff",
    inputTextColor: "#431407",
    inputBorder: "#fdba74",
    inputRadius: 10,
    inputHeight: 46,
    buttonText: "프로젝트 가져오기",
    buttonTextColor: "#ffffff",
    buttonTextSize: 15,
    buttonPaddingX: 22,
    buttonPaddingY: 12,
    buttonRadius: 10,
  },
];
