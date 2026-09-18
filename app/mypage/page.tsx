"use client";

import Header from "@/components/header/Header";
import MyPageDialog from "./_components/MyPageDialog";
import ProfileHero from "./_components/ProfileHero";
import WorkspacePanels from "./_components/WorkspacePanels";
import { useMyPage } from "./_hooks/useMyPage";
import "./page.css";

export default function MyPage() {
  const state = useMyPage();
  return (
    <div className="mypage-view">
      <a href="#saved-components" className="skip-link">저장 목록으로 이동</a>
      <Header />
      <main>
        <ProfileHero profile={state.profile} followerLabel={state.followerLabel} followingLabel={state.followingLabel} onEdit={() => state.setDialog("edit")} onFollowers={() => state.setDialog("followers")} onFollowing={() => state.setDialog("following")} />
        <WorkspacePanels items={state.saved} onRemove={state.removeSaved} activeTab={state.activeTab} onTabChange={state.setActiveTab} />
        <div className="mypage-account-button-wrap"><button type="button" className="mypage-account-button" onClick={() => state.setDialog("account")}><span>Settings</span><small>Email · Language · Password · Delete Account</small><b aria-hidden="true">→</b></button></div>
      </main>
      {state.notice && <p className="mypage-toast" role="status">{state.notice}</p>}
      <MyPageDialog kind={state.dialog} profile={state.profile} account={state.account} onClose={() => state.setDialog(null)} onSave={(profile) => { state.setProfile(profile); state.showNotice("프로필 변경사항을 저장했어요."); }} onSaveAccount={state.setAccount} onOpenWithdraw={() => state.setDialog("withdraw")} onWithdraw={() => state.showNotice("현재는 탈퇴 요청 화면만 제공해요.")} onNotice={state.showNotice} />
    </div>
  );
}
