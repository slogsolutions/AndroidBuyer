// src/context/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AuthState, User, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { authService } from '../services/auth.service';
import api from '../utils/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ user?: User }>;
  logout: () => void;
  googleLogin: (credential: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAIL'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, user: action.payload, loading: false, error: null };
    case 'LOGIN_FAIL':
      return { ...state, isAuthenticated: false, user: null, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null, loading: false, error: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, loading: true };
    default:
      return state;
  }
}

/**
 * Helper: normalize user to send to RN (small payload)
 */
function normalizeUserForRN(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw._id ?? raw.userId ?? raw.uid ?? null;
  if (!id) return null;
  return { id: String(id), email: raw.email ?? raw.mail ?? null, name: raw.name ?? raw.fullName ?? null };
}

/**
 * Robust sendUserToRN (tries a few times if bridge not ready)
 */
function sendUserToRN(user: any, tries = 8, delay = 250) {
  if (typeof window === 'undefined') return;

  if (!user) {
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_INFO', user: null }));
        console.log('[WEB DEBUG] Sent USER_INFO (null) to RN');
      } else {
        console.log('[WEB DEBUG] ReactNativeWebView not available -> not sending USER_INFO null');
      }
    } catch (e) {
      console.warn('[WEB DEBUG] Error sending null USER_INFO', e);
    }
    return;
  }

  const normalized = normalizeUserForRN(user);
  console.log('[WEB DEBUG] sendUserToRN called. raw user:', user, 'normalized for RN:', normalized);

  if (!normalized) {
    console.log('[WEB DEBUG] No usable id in user object; not sending to RN.');
    return;
  }

  const payload = JSON.stringify({ type: 'USER_INFO', user: normalized });

  // Heuristics: bridge available, or RN explicitly flagged window.__IS_RN_WEBVIEW
  const bridgeReady = !!(window as any).ReactNativeWebView?.postMessage;
  const rnFlag = !!(window as any).__IS_RN_WEBVIEW;
  const ua = navigator?.userAgent ?? '';
  const looksLikeWebView = /wv|Android.*WebView|ReactNative/i.test(ua);

  if (!bridgeReady && !rnFlag && !looksLikeWebView) {
    console.log('[WEB DEBUG] Looks like a regular browser (not RN WebView) -> skipping sendUserToRN');
    return;
  }

  let attempts = tries;
  const attempt = () => {
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(payload);
        console.log('[WEB DEBUG] postMessage called -> payload sent to RN:', payload);
        return;
      } else {
        console.log('[WEB DEBUG] ReactNativeWebView.postMessage not ready, attempts left=', attempts - 1);
      }
    } catch (e) {
      console.warn('[WEB DEBUG] postMessage threw', e);
    }
    attempts--;
    if (attempts > 0) setTimeout(attempt, delay);
    else console.log('[WEB DEBUG] Could not send USER_INFO to RN (bridge not available after retries).');
  };
  attempt();
}

/**
 * Helper to expose global reference for RN to pull when bridge becomes ready.
 * This keeps a normalized copy on window.__CURRENT_USER_FOR_RN and exposes window.sendUserToRN as easy callable.
 */
function setGlobalUserForRN(user: any | null) {
  try {
    if (typeof window === 'undefined') return;
    if (!user) {
      (window as any).__CURRENT_USER_FOR_RN = null;
      // expose convenience function
      (window as any).sendUserToRN = (u?: any) => sendUserToRN(u ?? null);
      console.log('[WEB DEBUG] Cleared __CURRENT_USER_FOR_RN');
      return;
    }
    const normalized = normalizeUserForRN(user);
    (window as any).__CURRENT_USER_FOR_RN = normalized;
    (window as any).sendUserToRN = (u?: any) => sendUserToRN(u ?? (window as any).__CURRENT_USER_FOR_RN);
    console.log('[WEB DEBUG] set __CURRENT_USER_FOR_RN', normalized);
  } catch (e) {
    console.warn('[WEB DEBUG] setGlobalUserForRN error', e);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(authReducer, initialState);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = (await authService.getMe()) as any;
          console.log('[WEB DEBUG] authService.getMe() returned:', user);
          dispatch({ type: 'LOGIN_SUCCESS', payload: { ...user, phoneVerified: !!user.phoneVerified } });

          setGlobalUserForRN(user); // <- expose on window for RN
          sendUserToRN(user); // attempt immediate send
        } catch (error) {
          console.warn('[WEB DEBUG] getMe failed:', error);
          localStorage.removeItem('token');
          dispatch({ type: 'LOGIN_FAIL', payload: 'Session expired' });
          setGlobalUserForRN(null);
        }
      } else {
        dispatch({ type: 'LOGOUT' });
        setGlobalUserForRN(null);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = (await authService.login(email, password)) as { token: string; user: any };
      console.log('[WEB DEBUG] login response data:', data);
      localStorage.setItem('token', data.token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
      setGlobalUserForRN(data.user);
      sendUserToRN(data.user);
    } catch (error: any) {
      console.warn('[WEB DEBUG] login failed:', error);
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'LOGIN_FAIL', payload: message });
      setGlobalUserForRN(null);
      throw message;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const data = (await authService.register(name, email, password)) as { user?: any };
      console.log('[WEB DEBUG] register response:', data);
      if (data?.user) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
        setGlobalUserForRN(data.user);
        sendUserToRN(data.user);
      } else {
        dispatch({ type: 'LOGIN_FAIL', payload: '' });
        setGlobalUserForRN(null);
      }
      return data;
    } catch (error: any) {
      console.warn('[WEB DEBUG] register failed:', error);
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'LOGIN_FAIL', payload: message });
      setGlobalUserForRN(null);
      throw message;
    }
  };

  const googleLogin = async (credential: string) => {
    try {
      const data = (await authService.googleLogin(credential)) as { token: string; user: any };
      console.log('[WEB DEBUG] googleLogin response:', data);
      localStorage.setItem('token', data.token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
      setGlobalUserForRN(data.user);
      sendUserToRN(data.user);
    } catch (error: any) {
      console.warn('[WEB DEBUG] googleLogin failed:', error);
      const message = error.response?.data?.message || 'Google login failed';
      dispatch({ type: 'LOGIN_FAIL', payload: message });
      setGlobalUserForRN(null);
      throw message;
    }
  };


  //Logout OLD
  // const logout = async () => {
  //   const token = localStorage.getItem('fcm_token');
  //   if (token) {
  //     await api.delete('/users/delete-token', { data: { fcmToken: token } } as any);
  //     localStorage.removeItem('fcm_token');
  //   }
  //   localStorage.removeItem('token');
  //   dispatch({ type: 'LOGOUT' });
  //   setGlobalUserForRN(null);
  //   try {
  //     if ((window as any).ReactNativeWebView?.postMessage) {
  //       (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_INFO', user: null }));
  //       console.log('[WEB DEBUG] Sent USER_INFO(null) on logout to RN');
  //     } else {
  //       console.log('[WEB DEBUG] ReactNativeWebView not available at logout time');
  //     }
  //   } catch (e) {
  //     console.warn('[WEB DEBUG] error sending logout USER_INFO to RN', e);
  //   }
  // };

  const logout = async () => {
  try {
    const fcmToken = localStorage.getItem("fcm_token");

    if (fcmToken) {
      // Call your backend delete-token endpoint (POST)
      await api.post("/users/delete-token", { fcmToken });
      localStorage.removeItem("fcm_token");
    }

    // remove auth/session token
    localStorage.removeItem("token");

    // update state/context
    dispatch({ type: "LOGOUT" });
    setGlobalUserForRN(null);

    // notify React Native WebView (if present)
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: "USER_INFO", user: null })
      );
      console.log("[WEB DEBUG] Sent USER_INFO(null) on logout to RN");
    } else {
      console.log("[WEB DEBUG] ReactNativeWebView not available at logout time");
    }
  } catch (e) {
    console.warn("[WEB DEBUG] error during logout:", e);
  }
};

  const setUser = (user: User | null) => {
  if (user) {
    dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    setGlobalUserForRN(user);
    sendUserToRN(user);
  } else {
    dispatch({ type: 'LOGOUT' });
    setGlobalUserForRN(null);
    sendUserToRN(null);
  }
};

const refreshUser = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      setGlobalUserForRN(null);
      return;
    }
    const user = (await authService.getMe()) as any;
    console.log('[WEB DEBUG] refreshUser getMe returned:', user);
    dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    setGlobalUserForRN(user);
    sendUserToRN(user);
  } catch (error) {
    console.error('refreshUser failed', error);
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
    setGlobalUserForRN(null);
    sendUserToRN(null);
  }
};

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        googleLogin,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
