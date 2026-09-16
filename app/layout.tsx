import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tmp — Main Page",
  description: "Explore UI components, preview designs, and discover this week’s trending interfaces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
