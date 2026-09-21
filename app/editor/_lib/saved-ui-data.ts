export type EditableUi = {
  id: number;
  name: string;
  type: string;
  eyebrow: string;
  heading: string;
  label: string;
  placeholder: string;
  buttonText: string;
  accent: string;
  background: string;
  textColor: string;
  eyebrowColor: string;
  eyebrowSize: number;
  headingColor: string;
  headingSize: number;
  labelColor: string;
  labelSize: number;
  inputBorder: string;
  inputBackground: string;
  inputTextColor: string;
  inputRadius: number;
  inputHeight: number;
  buttonTextColor: string;
  buttonTextSize: number;
  buttonPaddingX: number;
  buttonPaddingY: number;
  buttonRadius: number;
  borderColor: string;
  borderWidth: number;
  shadow: number;
  radius: number;
  padding: number;
};

export const savedUiSeed: EditableUi[] = [
  { id: 1, name: "Newsletter signup", type: "INPUT", eyebrow: "POLAZU COMPONENT", heading: "Join our newsletter", label: "Email address", placeholder: "hello@example.com", buttonText: "Sign up", accent: "#ff4d0a", background: "#f7f7f5", textColor: "#26242b", eyebrowColor: "#ff4d0a", eyebrowSize: 11, headingColor: "#26242b", headingSize: 25, labelColor: "#4b4b52", labelSize: 13, inputBorder: "#dedde3", inputBackground: "#ffffff", inputTextColor: "#26242b", inputRadius: 7, inputHeight: 42, buttonTextColor: "#ffffff", buttonTextSize: 13, buttonPaddingX: 18, buttonPaddingY: 12, buttonRadius: 6, borderColor: "#dedde3", borderWidth: 1, shadow: 12, radius: 16, padding: 32 },
  { id: 2, name: "Minimal account card", type: "PROFILE", eyebrow: "POLAZU COMPONENT", heading: "Welcome back", label: "Username", placeholder: "Your username", buttonText: "Continue", accent: "#6f9fe8", background: "#edf3ff", textColor: "#202a3a", eyebrowColor: "#567db8", eyebrowSize: 11, headingColor: "#202a3a", headingSize: 27, labelColor: "#43516a", labelSize: 13, inputBorder: "#c8d8ef", inputBackground: "#ffffff", inputTextColor: "#202a3a", inputRadius: 7, inputHeight: 42, buttonTextColor: "#ffffff", buttonTextSize: 13, buttonPaddingX: 18, buttonPaddingY: 12, buttonRadius: 8, borderColor: "#c8d8ef", borderWidth: 1, shadow: 12, radius: 20, padding: 36 },
  { id: 3, name: "Checkout flow", type: "COMMERCE", eyebrow: "POLAZU COMPONENT", heading: "Complete your order", label: "Card number", placeholder: "0000 0000 0000 0000", buttonText: "Pay now", accent: "#9c4b2d", background: "#faeee5", textColor: "#37221a", eyebrowColor: "#9c4b2d", eyebrowSize: 11, headingColor: "#37221a", headingSize: 24, labelColor: "#674638", labelSize: 13, inputBorder: "#dfc9bd", inputBackground: "#ffffff", inputTextColor: "#37221a", inputRadius: 7, inputHeight: 42, buttonTextColor: "#ffffff", buttonTextSize: 13, buttonPaddingX: 18, buttonPaddingY: 12, buttonRadius: 5, borderColor: "#dfc9bd", borderWidth: 1, shadow: 12, radius: 12, padding: 28 },
  { id: 4, name: "Music dashboard", type: "DASHBOARD", eyebrow: "POLAZU COMPONENT", heading: "Now playing", label: "Search music", placeholder: "Artist, album or track", buttonText: "Play", accent: "#7f5af0", background: "#f4f0ff", textColor: "#292238", eyebrowColor: "#6d4dd3", eyebrowSize: 11, headingColor: "#292238", headingSize: 28, labelColor: "#51486b", labelSize: 13, inputBorder: "#d8cdf2", inputBackground: "#ffffff", inputTextColor: "#292238", inputRadius: 7, inputHeight: 42, buttonTextColor: "#ffffff", buttonTextSize: 13, buttonPaddingX: 18, buttonPaddingY: 12, buttonRadius: 12, borderColor: "#d8cdf2", borderWidth: 1, shadow: 12, radius: 24, padding: 34 },
];
