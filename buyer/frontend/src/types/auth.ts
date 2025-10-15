export interface User {
  id: string;
  email: string;
  name: string;
  isVerified: boolean;
  kycCompleted: boolean;
    phoneVerified?: boolean;

}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  confirmPassword: string;
}