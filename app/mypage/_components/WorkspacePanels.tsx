"use client";

import { useState } from "react";
import type { SavedItem } from "../data";
import SavedGrid from "./SavedGrid";
import ProjectWorkspace from "./ProjectWorkspace";

type WorkspacePanelsProps = {
  items: SavedItem[];
  onRemove: (id: number) => void;
  activeTab?: number;
  onTabChange?: (tab: number) => void;
};

type Category = {
  id: number;
  name: string;
  itemIds: number[];
};

type CategoryDialog = {
  scope: "components" | "downloads";
  categoryId: number | null;
} | null;

const tabs = ["MY COMPONENTS", "DOWNLOADS", "MY PROJECTS"] as const;

const initialDownloads: SavedItem[] = [
  { id: 101, title: "Search command palette", type: "INPUT", colors: ["#f8f8f6", "#ff4d0a"], likes: "31.4K", views: "18.2K" },
  { id: 102, title: "Creator profile card", type: "CONTENT", colors: ["#edf3ff", "#6f9fe8"], likes: "22.8K", views: "14.5K" },
  { id: 103, title: "Floating navigation", type: "NAVIGATION", colors: ["#faeee5", "#9c4b2d"], likes: "18.4K", views: "10.8K" },
  { id: 104, title: "Audio player", type: "MEDIA", colors: ["#f4f0ff", "#7f5af0"], likes: "12.1K", views: "9.6K" },
];

export default function WorkspacePanels({ items, onRemove, activeTab: externalTab, onTabChange }: WorkspacePanelsProps) {
  const [internalTab, setInternalTab] = useState(0);
  const activeTab = externalTab !== undefined ? externalTab : internalTab;
  const setActiveTab = (index: number) => {
    setInternalTab(index);
    if (onTabChange) onTabChange(index);
  };
  const [downloads, setDownloads] = useState(initialDownloads);
  const [componentCategories, setComponentCategories] = useState<Category[]>([]);
  const [downloadCategories, setDownloadCategories] = useState<Category[]>([]);
  const [componentCategory, setComponentCategory] = useState<number | null>(null);
  const [downloadCategory, setDownloadCategory] = useState<number | null>(null);
  const [dialog, setDialog] = useState<CategoryDialog>(null);
  const [draftName, setDraftName] = useState("");
  const [draftItemIds, setDraftItemIds] = useState<number[]>([]);

  const dialogItems = dialog?.scope === "components" ? items : downloads;

  function openCategoryDialog(scope: "components" | "downloads", category?: Category) {
    setDraftName(category?.name ?? "");
    setDraftItemIds(category?.itemIds ?? []);
    setDialog({ scope, categoryId: category?.id ?? null });
  }

  function closeCategoryDialog() {
    setDialog(null);
    setDraftName("");
    setDraftItemIds([]);
  }

  function saveCategory() {
    if (!dialog || !draftName.trim() || draftItemIds.length === 0) return;
    const update = dialog.scope === "components" ? setComponentCategories : setDownloadCategories;
    if (dialog.categoryId === null) {
      update((current) => [...current, { id: Date.now(), name: draftName.trim(), itemIds: draftItemIds }]);
    } else {
      update((current) => current.map((category) => category.id === dialog.categoryId ? { ...category, name: draftName.trim(), itemIds: draftItemIds } : category));
    }
    closeCategoryDialog();
  }

  function deleteCategory() {
    if (!dialog || dialog.categoryId === null) return;
    if (dialog.scope === "components") {
      setComponentCategories((current) => current.filter((category) => category.id !== dialog.categoryId));
      if (componentCategory === dialog.categoryId) setComponentCategory(null);
    } else {
      setDownloadCategories((current) => current.filter((category) => category.id !== dialog.categoryId));
      if (downloadCategory === dialog.categoryId) setDownloadCategory(null);
    }
    closeCategoryDialog();
  }

  function toggleDraftItem(id: number) {
    setDraftItemIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function categorySection(scope: "components" | "downloads", categories: Category[], selectedId: number | null, onSelect: (id: number | null) => void) {
    return (
      <div className="mypage-category">
        <h2>CATEGORY</h2>
        <div className="mypage-category-circles">
          <button type="button" className={selectedId === null ? "mypage-category-all is-active" : "mypage-category-all"} onClick={() => onSelect(null)}>
            <i>ALL</i><span>전체</span>
          </button>
          {categories.map((category) => (
            <div className="mypage-category-created" key={category.id}>
              <button type="button" className={selectedId === category.id ? "is-active" : ""} onClick={() => onSelect(category.id)}>
                <i>{category.name.slice(0, 2).toUpperCase()}</i><span>{category.name}</span>
              </button>
              <button type="button" className="mypage-category-edit" onClick={() => openCategoryDialog(scope, category)} aria-label={`${category.name} 카테고리 수정`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l10.7-10.7-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>
              </button>
            </div>
          ))}
          <button type="button" className="mypage-category-add" onClick={() => openCategoryDialog(scope)} aria-label="새 카테고리 추가">
            <i>+</i><span>추가</span>
          </button>
        </div>
      </div>
    );
  }

  function componentPanel(list: SavedItem[], categories: Category[], selectedId: number | null, onSelect: (id: number | null) => void, scope: "components" | "downloads", title: string, eyebrow: string, remove: (id: number) => void) {
    const selectedCategory = categories.find((category) => category.id === selectedId);
    const visibleItems = selectedCategory ? list.filter((item) => selectedCategory.itemIds.includes(item.id)) : list;
    return (
      <>
        {categorySection(scope, categories, selectedId, onSelect)}
        <div className="mypage-panel-heading"><p>{eyebrow}</p><h2>{selectedCategory?.name ?? title} <span>{visibleItems.length}</span></h2></div>
        {visibleItems.length > 0
          ? <SavedGrid items={visibleItems} onRemove={remove} />
          : <div className="mypage-category-empty"><b>{selectedCategory?.name}</b><span>이 카테고리에 선택된 컴포넌트가 없어요.</span></div>}
      </>
    );
  }

  return (
    <section className="mypage-workspace" aria-label="내 작업">
      <div className="mypage-workspace-tabs" role="tablist" aria-label="마이페이지 작업 메뉴">
        {tabs.map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={activeTab === index} aria-controls={`mypage-panel-${index}`} onClick={() => setActiveTab(index)}>{tab}</button>)}
        <span className="mypage-tab-indicator" style={{ transform: `translateX(${activeTab * 100}%)` }} aria-hidden="true" />
      </div>

      <div className="mypage-slider">
        <div className="mypage-slide-track" style={{ transform: `translateX(-${activeTab * 100}%)` }}>
          <section id="mypage-panel-0" className="mypage-slide" role="tabpanel" aria-hidden={activeTab !== 0}>
            {componentPanel(items, componentCategories, componentCategory, setComponentCategory, "components", "내 컴포넌트", "UPLOADED BY ME", onRemove)}
          </section>
          <section id="mypage-panel-1" className="mypage-slide" role="tabpanel" aria-hidden={activeTab !== 1}>
            {componentPanel(downloads, downloadCategories, downloadCategory, setDownloadCategory, "downloads", "다운로드한 컴포넌트", "FROM OTHER CREATORS", (id) => setDownloads((current) => current.filter((item) => item.id !== id)))}
          </section>
          <section id="mypage-panel-2" className="mypage-slide" role="tabpanel" aria-hidden={activeTab !== 2}>
            <ProjectWorkspace />
          </section>
        </div>
      </div>

      {dialog && (
        <div className="mypage-dialog-backdrop" role="presentation" onMouseDown={closeCategoryDialog}>
          <section className="mypage-dialog mypage-category-dialog" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="mypage-dialog-close" onClick={closeCategoryDialog} aria-label="닫기">×</button>
            <p className="mypage-eyebrow">CATEGORY</p>
            <h2 id="category-dialog-title">{dialog.categoryId === null ? "카테고리 추가" : "카테고리 수정"}</h2>
            <label>카테고리 이름<input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="예: 로그인 UI" maxLength={20} autoFocus /></label>
            <fieldset>
              <legend>포함할 컴포넌트</legend>
              <div className="mypage-category-checklist">
                {dialogItems.map((item) => <label key={item.id}><input type="checkbox" checked={draftItemIds.includes(item.id)} onChange={() => toggleDraftItem(item.id)} /><span><b>{item.title}</b><small>{item.type}</small></span></label>)}
              </div>
            </fieldset>
            <button type="button" className="mypage-primary" disabled={!draftName.trim() || draftItemIds.length === 0} onClick={saveCategory}>{dialog.categoryId === null ? "카테고리 만들기" : "변경사항 저장"}</button>
            {dialog.categoryId !== null && <button type="button" className="mypage-category-delete" onClick={deleteCategory}>카테고리 삭제</button>}
          </section>
        </div>
      )}
    </section>
  );
}
