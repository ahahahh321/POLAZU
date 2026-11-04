"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Member } from "@/components/auth/types";

type Intro = { name: string; bio: string; website: string; photo: string };
const emptyIntro: Intro = { name: "", bio: "", website: "", photo: "" };

export default function PersonalProfile({ user }: { user: Member }) {
  const key = "polazu:personal-profile:v1:" + user.id;
  const [profile, setProfile] = useState<Intro>(emptyIntro);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const name = profile.name || user.name;
  const photo = profile.photo || user.profileImageUrl;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setProfile({ ...emptyIntro, ...JSON.parse(raw) });
    } catch {
      setError("저장한 프로필을 불러오지 못했어요.");
    }
  }, [key]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const website = String(data.get("website") ?? "").trim();
    setError("");
    if (website && !/^https?:\/\//i.test(website)) {
      setError("링크는 http:// 또는 https://로 시작해야 해요.");
      return;
    }
    const file = data.get("photo");
    if (file instanceof File && file.size && (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_000_000)) {
      setError("1MB 이하의 PNG, JPEG 또는 WebP 이미지를 선택하세요.");
      return;
    }
    setSaving(true);
    try {
      let nextPhoto = data.has("resetPhoto") ? "" : profile.photo;
      if (file instanceof File && file.size) {
        nextPhoto = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      const next = {
        name: String(data.get("name") ?? "").trim(),
        bio: String(data.get("bio") ?? "").trim(),
        website,
        photo: nextPhoto,
      };
      localStorage.setItem(key, JSON.stringify(next));
      setProfile(next);
      setEditing(false);
      setSaved(true);
    } catch {
      setError("프로필을 브라우저에 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="pz-workspace-profile" aria-labelledby="workspace-name">
    <div className="pz-profile-cover" aria-hidden="true" />
    <div className="pz-profile-content">
      <div className="pz-profile-toolbar">
        <div className="pz-workspace-avatar" aria-hidden="true">
          {photo ? <img src={photo} alt="" /> : name.trim().charAt(0).toUpperCase()}
        </div>
        <button className="pz-secondary" type="button" aria-expanded={editing}
          onClick={() => { setEditing(!editing); setError(""); setSaved(false); }}>프로필 수정</button>
      </div>
      <h1 id="workspace-name">{name}</h1>
      <p className="pz-workspace-handle">@{user.nickname}</p>
      {profile.bio && <p className="pz-profile-bio">{profile.bio}</p>}
      {/^https?:\/\//i.test(profile.website) && <a className="pz-profile-link" href={profile.website} target="_blank" rel="noreferrer">{profile.website} ↗</a>}
      {saved && <p role="status">프로필을 저장했어요.</p>}
      {error && <p role="alert">{error}</p>}
      {editing && <form className="pz-profile-form" onSubmit={(event) => void save(event)}>
        <label>표시 이름<input name="name" defaultValue={name} required maxLength={50} /></label>
        <label>자기소개<textarea name="bio" defaultValue={profile.bio} rows={3} maxLength={240} placeholder="어떤 UI를 만들고 있는지 소개해 보세요." /></label>
        <label>웹사이트<input name="website" type="url" defaultValue={profile.website} maxLength={300} placeholder="https://example.com" /></label>
        <label>프로필 사진<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        {profile.photo && <label className="pz-profile-reset"><input type="checkbox" name="resetPhoto" /> 계정 사진으로 되돌리기</label>}
        <div className="pz-workspace-tools">
          <button className="pz-primary" type="submit" disabled={saving}>{saving ? "저장 중…" : "저장하기"}</button>
          <button className="pz-secondary" type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }}>취소</button>
        </div>
      </form>}
    </div>
  </section>;
}
