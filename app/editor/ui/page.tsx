"use client";

import Header from "@/components/header/Header";
import SavedUiEditor from "../_components/SavedUiEditor";
import "../page.css";

export default function UiEditorPage() {
  return (
    <div className="editor-page-view">
      <Header activeNav="Editor" />
      <main className="editor-runtime-container">
        <SavedUiEditor />
      </main>
    </div>
  );
}
