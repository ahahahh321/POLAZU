export type SavedItem = {
  id: number;
  title: string;
  type: string;
  colors: [string, string];
  likes: string;
  views: string;
};

export const profileSeed = {
  name: "CHOI JIYOO",
  handle: "@jiyoo.choi",
  bio: "Product designer building quiet, useful digital spaces.",
  avatarUrl: "",
  followers: 12400,
  following: 368,
  totalLikes: "89.2K",
};

export const accountSeed = {
  email: "jiyoo.choi@example.com",
  language: "ko",
};

export const people = [
  { id: 1, name: "Mina Kim", handle: "@minakim", initials: "MK", tone: "#ef6a2c" },
  { id: 2, name: "Joon Park", handle: "@joonpark", initials: "JP", tone: "#5c7798" },
  { id: 3, name: "Sora Lee", handle: "@sora.lee", initials: "SL", tone: "#b45f80" },
];

export const savedItems: SavedItem[] = [
  { id: 1, title: "Newsletter signup", type: "INPUT", colors: ["#f8f8f6", "#ff4d0a"], likes: "89.2K", views: "89.2K" },
  { id: 2, title: "Minimal account card", type: "PROFILE", colors: ["#edf3ff", "#93bdf5"], likes: "22.8K", views: "14.5K" },
  { id: 3, title: "Checkout flow", type: "COMMERCE", colors: ["#faeee5", "#9c4b2d"], likes: "18.4K", views: "10.8K" },
  { id: 4, title: "Music dashboard", type: "DASHBOARD", colors: ["#f4f0ff", "#7f5af0"], likes: "12.1K", views: "9.6K" },
];
