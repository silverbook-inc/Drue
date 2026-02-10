import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }
    hasHandledCallback.current = true;

    const completeAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        navigate('/dashboard', { replace: true });
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

      if (!code) {
        setError(providerError ?? 'Missing authorization code in callback URL.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      navigate('/dashboard', { replace: true });
    };

    void completeAuth();
  }, [navigate]);

  return (
    <main className="page auth-page">
      <section className="auth-card">
        <h1>Completing sign-in...</h1>
        {error ? (
          <>
            <p className="error">{error}</p>
            <Link className="link-back" to="/login">
              Back to login
            </Link>
          </>
        ) : (
          <p>Please wait while we verify your account.</p>
        )}
      </section>
    </main>
  );
}
