import Link from "next/link";
import "./brand-logo.css";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return <Link href="/" className={`polazu-brand ${className}`} aria-label="POLAZU 홈">
    <img src="/polazu-wordmark.png" width={888} height={136} alt="" />
  </Link>;
}
