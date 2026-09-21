export interface Member {
  id: number;
  email: string;
  name: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  createdAt: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  nickname: string;
  profileImageUrl?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: Member | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<Member>;
  signup: (input: SignUpInput) => Promise<Member>;
  logout: () => Promise<void>;
  refresh: () => Promise<Member | null>;
}
