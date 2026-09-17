import { profileSeed } from "../data";

type Profile = typeof profileSeed;

type ProfileHeroProps = {
  profile: Profile;
  followerLabel: string;
  followingLabel: string;
  onEdit: () => void;
  onFollowers: () => void;
  onFollowing: () => void;
};

export default function ProfileHero({ profile, followerLabel, followingLabel, onEdit, onFollowers, onFollowing }: ProfileHeroProps) {
  const initials = profile.name.split(" ").map((word) => word[0]).join("").slice(0, 2);

  return (
    <section className="mypage-hero" aria-labelledby="profile-name">
      <button type="button" className="mypage-avatar" onClick={onEdit} aria-label="프로필 수정">
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}
        <i aria-hidden="true" />
        <span className="mypage-avatar-edit" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m4 16-.8 4.8L8 20l10.7-10.7-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>
          프로필 수정
        </span>
      </button>
      <p className="mypage-handle">{profile.handle}</p>
      <h1 id="profile-name">{profile.name}</h1>
      <p className="mypage-bio">{profile.bio}</p>
      <div className="mypage-stats" aria-label="프로필 통계">
        <button type="button" onClick={onFollowers}><strong>FOLLOWERS</strong><span>{followerLabel}</span></button>
        <button type="button" onClick={onFollowing}><strong>FOLLOWING</strong><span>{followingLabel}</span></button>
      </div>
    </section>
  );
}
