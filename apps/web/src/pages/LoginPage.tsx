import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginWithGoogle = async () => {
    setError(null);
    setIsLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true'
        }
      }
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="page auth-page">
      <section className="auth-card">
        <p className="eyebrow">Log in</p>
        <h1>Sign in to Drue</h1>
        <p>Use your Google account to continue.</p>
        <button className="button primary full" onClick={loginWithGoogle} disabled={isLoading}>
          {isLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>
        {error ? <p className="error">{error}</p> : null}
        <Link className="link-back" to="/">
          Back to landing page
        </Link>
      </section>
    </main>
  );
}
