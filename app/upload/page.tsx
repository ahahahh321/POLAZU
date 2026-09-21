"use client";

import Header from "@/components/header/Header";
import "./upload.css";

export default function UploadPage() {
  return (
    <div className="upload-view">
      <Header activeNav="Upload" />

      <main className="upload-container">
        {/* 개발 영역: 새로운 업로드 기능을 여기에 구현하세요 */}
        <div className="upload-placeholder">
          <h1 className="upload-title">Upload</h1>
          <p className="upload-subtitle">업로드 페이지 개발 영역입니다.</p>
        </div>
      </main>
    </div>
  );
}
