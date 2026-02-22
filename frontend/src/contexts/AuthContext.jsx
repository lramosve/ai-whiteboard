import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Turnstile } from '@marsidev/react-turnstile';

const AuthContext = createContext({});

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsAnonymousSignIn, setNeedsAnonymousSignIn] = useState(false);
  const captchaRef = useRef(null);

  const isAnonymous = user?.is_anonymous === true;

  useEffect(() => {
    // Get initial session — if none, sign in anonymously
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setLoading(false);
      } else if (TURNSTILE_SITE_KEY) {
        // With CAPTCHA: wait for token before signing in anonymously
        setNeedsAnonymousSignIn(true);
      } else {
        // Without CAPTCHA: sign in anonymously immediately
        supabase.auth.signInAnonymously().then(({ error }) => {
          if (error) console.error('Anonymous sign-in failed:', error);
          setLoading(false);
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Called when invisible Turnstile solves
  const handleCaptchaSuccess = async (token) => {
    if (!needsAnonymousSignIn) return;
    setNeedsAnonymousSignIn(false);
    const { error } = await supabase.auth.signInAnonymously({
      options: { captchaToken: token },
    });
    if (error) console.error('Anonymous sign-in failed:', error);
    setLoading(false);
  };

  const signup = async (email, password, displayName, captchaToken) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        data: {
          display_name: displayName,
        }
      }
    });

    if (error) throw error;
    return data;
  };

  const signin = async (email, password, captchaToken) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });

    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Re-enter guest mode
    if (TURNSTILE_SITE_KEY) {
      captchaRef.current?.reset();
      setNeedsAnonymousSignIn(true);
    } else {
      await supabase.auth.signInAnonymously();
    }
  };

  const getIdToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const value = {
    user,
    loading,
    isAnonymous,
    signup,
    signin,
    signInWithGoogle,
    logout,
    getIdToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {TURNSTILE_SITE_KEY && needsAnonymousSignIn && (
        <Turnstile
          ref={captchaRef}
          siteKey={TURNSTILE_SITE_KEY}
          size="invisible"
          onSuccess={handleCaptchaSuccess}
        />
      )}
    </AuthContext.Provider>
  );
}
