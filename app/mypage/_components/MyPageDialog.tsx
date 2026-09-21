"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { accountSeed, people, profileSeed } from "../data";

type Profile = typeof profileSeed;
type Account = typeof accountSeed;
type DialogKind = "edit" | "followers" | "following" | "account" | "withdraw" | null;

type MyPageDialogProps = {
  kind: DialogKind;
  profile: Profile;
  account: Account;
  onClose: () => void;
  onSave: (profile: Profile) => void;
  onSaveAccount: (account: Account) => void;
  onOpenWithdraw: () => void;
  onWithdraw: () => void;
  onNotice: (message: string) => void;
};

export default function MyPageDialog({ kind, profile, account, onClose, onSave, onSaveAccount, onOpenWithdraw, onWithdraw, onNotice }: MyPageDialogProps) {
  const [draft, setDraft] = useState(profile);
  const [accountDraft, setAccountDraft] = useState(account);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (kind === "edit") setDraft(profile);
    if (kind === "account") {
      setAccountDraft(account);
      setPassword("");
    }
  }, [kind, profile, account]);

  if (!kind) return null;
  const relationship = kind === "followers" ? "팔로워" : "팔로잉";

  function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      onNotice("5MB 이하 이미지 파일을 선택해 주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, avatarUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="mypage-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="mypage-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="mypage-dialog-close" onClick={onClose} aria-label="닫기">×</button>

        {kind === "edit" && <>
          <p className="mypage-eyebrow">PROFILE SETTINGS</p><h2 id="dialog-title">프로필 수정</h2>
          <label className="mypage-photo-field">프로필 사진
            <span className="mypage-photo-preview">
              {draft.avatarUrl ? <img src={draft.avatarUrl} alt="선택한 프로필 사진 미리보기" /> : draft.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} />
            <small>JPG, PNG, WEBP · 최대 5MB</small>
          </label>
          <label>이름<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={30} /></label>
          <label>소개<textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} maxLength={120} rows={3} /></label>
          <button type="button" className="mypage-primary" onClick={() => { onSave(draft); onClose(); }}>변경사항 저장</button>
        </>}

        {kind === "account" && <>
          <p className="mypage-eyebrow">ACCOUNT SETTINGS</p><h2 id="dialog-title">계정 설정</h2>
          <label>이메일<input type="email" value={accountDraft.email} onChange={(event) => setAccountDraft({ ...accountDraft, email: event.target.value })} /></label>
          <label>언어<select value={accountDraft.language} onChange={(event) => setAccountDraft({ ...accountDraft, language: event.target.value })}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select></label>
          <label>새 비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="변경할 때만 입력" minLength={8} /></label>
          <button type="button" className="mypage-primary" onClick={() => { onSaveAccount(accountDraft); onNotice(password ? "계정 정보와 비밀번호를 변경했어요." : "계정 정보를 변경했어요."); onClose(); }}>변경사항 저장</button>
          <div className="mypage-account-danger"><div><b>회원 탈퇴</b><p>계정과 저장 데이터를 삭제합니다.</p></div><button type="button" onClick={onOpenWithdraw}>회원 탈퇴</button></div>
        </>}

        {(kind === "followers" || kind === "following") && <>
          <p className="mypage-eyebrow">CONNECTIONS</p><h2 id="dialog-title">{relationship}</h2>
          <div className="mypage-people">{people.map((person) => <div key={person.id}><span style={{ background: person.tone }}>{person.initials}</span><p><b>{person.name}</b><small>{person.handle}</small></p><button type="button" onClick={() => onNotice(`${person.name}님에게 메시지를 보낼 수 있어요.`)}>메시지</button></div>)}</div>
        </>}

        {kind === "withdraw" && <>
          <p className="mypage-eyebrow">ACCOUNT</p><h2 id="dialog-title">정말 탈퇴할까요?</h2>
          <p className="mypage-dialog-copy">저장 목록과 프로필 정보가 삭제될 수 있습니다. 실제 탈퇴는 서버 API와 인증 정책이 연결된 후에만 처리됩니다.</p>
          <div className="mypage-dialog-actions"><button type="button" onClick={onClose}>취소</button><button type="button" className="mypage-danger" onClick={() => { onWithdraw(); onClose(); }}>탈퇴 요청</button></div>
        </>}
      </section>
    </div>
  );
}
