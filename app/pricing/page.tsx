"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/header/Header";
import "./pricing.css";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="pricing-view">
      <Header activeNav="Pricing" />

      <main className="pricing-container">
        <header className="pricing-header">
          <span className="pricing-eyebrow">POLAZU MEMBERSHIP PLANS</span>
          <h1 className="pricing-title">PRICING &amp; PLANS</h1>
          <p className="pricing-subtitle">
            개인 학습자부터 프로 개발팀까지, 나에게 꼭 맞는 요금제로 POLAZU의 강력한 UI 및 코드 변환 기능을 경험하세요.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pricing-toggle-wrap" role="group" aria-label="결제 주기 선택">
            <button
              type="button"
              className={`pricing-toggle-btn ${billingCycle === "monthly" ? "active" : ""}`}
              onClick={() => setBillingCycle("monthly")}
            >
              월간 결제
            </button>
            <button
              type="button"
              className={`pricing-toggle-btn ${billingCycle === "yearly" ? "active" : ""}`}
              onClick={() => setBillingCycle("yearly")}
            >
              연간 결제
              <span className="pricing-discount-badge">20% 할인</span>
            </button>
          </div>
        </header>

        {/* Pricing Cards */}
        <section className="pricing-grid" aria-label="요금제 종류">
          {/* Starter Plan */}
          <div className="pricing-card">
            <h2 className="pricing-plan-name">Starter</h2>
            <p className="pricing-plan-desc">
              학습과 사이드 프로젝트를 시작하는 모든 개발자를 위한 무료 플랜입니다.
            </p>
            <div className="pricing-price-wrap">
              <span className="pricing-price">₩0</span>
              <span className="pricing-period">/ 평생 무료</span>
            </div>
            <Link href="/signup" className="pricing-cta-btn secondary">
              무료로 시작하기
            </Link>

            <div className="pricing-features-title">포함된 기능</div>
            <ul className="pricing-features-list">
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>오픈소스 UI 컴포넌트 무제한 탐색</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>코드 언어 변환 (월 50회 제공)</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>웹 스튜디오 에디터 기본 기능</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>커뮤니티 공개 컴포넌트 업로드</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>표준 다운로드 속도 지원</span>
              </li>
            </ul>
          </div>

          {/* Pro Plan (Featured) */}
          <div className="pricing-card featured">
            <div className="pricing-card-badge">MOST POPULAR</div>
            <h2 className="pricing-plan-name">Pro</h2>
            <p className="pricing-plan-desc">
              빠른 프로토타이핑과 상용 프로덕트를 구축하는 전문 개발자를 위한 플랜입니다.
            </p>
            <div className="pricing-price-wrap">
              <span className="pricing-price">
                {billingCycle === "monthly" ? "₩9,900" : "₩7,900"}
              </span>
              <span className="pricing-period">/ 월 {billingCycle === "yearly" && "(연간 청구)"}</span>
            </div>
            <Link href="/signup" className="pricing-cta-btn primary">
              7일 무료 체험 시작하기
            </Link>

            <div className="pricing-features-title">Starter의 모든 기능 및 추가:</div>
            <ul className="pricing-features-list">
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <strong>무제한 다국어 실시간 코드 변환 (C, Java, Python, Go 등)</strong>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>비공개(Private) 컴포넌트 보관함</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>전체 프로젝트 원클릭 ZIP 다운로드</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>상업적 사용(Commercial) 라이선스 보장</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>프로필 PRO 공식 배지 수여</span>
              </li>
            </ul>
          </div>

          {/* Team Plan */}
          <div className="pricing-card">
            <h2 className="pricing-plan-name">Team</h2>
            <p className="pricing-plan-desc">
              공동 디자인 시스템 구축과 팀 협업을 위한 최적의 엔터프라이즈 플랜입니다.
            </p>
            <div className="pricing-price-wrap">
              <span className="pricing-price">
                {billingCycle === "monthly" ? "₩29,900" : "₩23,900"}
              </span>
              <span className="pricing-period">/ 월 {billingCycle === "yearly" && "(연간 청구)"}</span>
            </div>
            <Link href="/signup" className="pricing-cta-btn secondary">
              팀 플랜 문의하기
            </Link>

            <div className="pricing-features-title">Pro의 모든 기능 및 추가:</div>
            <ul className="pricing-features-list">
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>최대 10인 팀 협업 워크스페이스</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>조직 GitHub 레포지토리 직접 연동</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>공동 디자인 시스템 및 컴포넌트 레지스트리</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>역할 기반 권한 관리 (RBAC)</span>
              </li>
              <li className="pricing-feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>우선 기술 지원 및 전담 매니저 배정</span>
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="pricing-faq" aria-label="자주 묻는 질문">
          <h2 className="pricing-faq-title">자주 묻는 질문 (FAQ)</h2>
          <div className="pricing-faq-list">
            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">
                <span>Q.</span> 언제든 요금제를 변경하거나 취소할 수 있나요?
              </h3>
              <p className="pricing-faq-a">
                네, 언제든지 마이페이지 설정에서 위약금 없이 플랜을 변경하거나 해지하실 수 있습니다. 해지 시 남은 기간 동안은 계속해서 Pro 혜택이 유지됩니다.
              </p>
            </div>

            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">
                <span>Q.</span> 다운로드한 컴포넌트를 상업용 프로젝트에 사용할 수 있나요?
              </h3>
              <p className="pricing-faq-a">
                네, POLAZU의 오픈소스 컴포넌트는 각 라이선스(MIT 등) 범위 내에서 자유롭게 상업용 웹사이트나 모바일 앱에 활용할 수 있으며, Pro 플랜 사용자는 상업적 배포에 어떠한 제한도 받지 않습니다.
              </p>
            </div>

            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">
                <span>Q.</span> 무료 체험 7일 동안 결제가 바로 진행되나요?
              </h3>
              <p className="pricing-faq-a">
                체험 기간 동안에는 결제가 이루어지지 않습니다. 7일이 종료되기 하루 전 알림을 드리며, 원치 않으시면 언제든 클릭 한 번으로 취소하실 수 있습니다.
              </p>
            </div>

            <div className="pricing-faq-item">
              <h3 className="pricing-faq-q">
                <span>Q.</span> 어떤 결제 수단이 지원되나요?
              </h3>
              <p className="pricing-faq-a">
                국내 모든 신용카드 및 체크카드, 카카오페이, 네이버페이, 토스페이, 해외 카드(Visa, Mastercard, Amex)를 안전하게 지원합니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
