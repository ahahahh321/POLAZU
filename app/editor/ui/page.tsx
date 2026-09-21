"use client";

import { useEffect } from "react";

export default function UiEditorPage() {
  useEffect(()=>{window.location.replace(`/editor/${window.location.search}`);},[]);
  return <main className="route-gate"><p>기존 프로젝트 편집기로 이동하고 있습니다.</p></main>;
}
