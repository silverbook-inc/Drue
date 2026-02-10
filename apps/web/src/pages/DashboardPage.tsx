import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';

type MeResponse = {
  id?: string;
  email?: string | null;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setError('No active session found.');
        return;
      }

      const response = await fetch(`${env.API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: string };
        setError(payload.detail ?? 'Failed to load profile from API.');
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setProfile(payload);
    };

    void fetchProfile();
  }, []);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <main className="page dashboard-page">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={logout} className="button ghost" disabled={loading}>
          {loading ? 'Signing out...' : 'Sign out'}
        </button>
      </header>
      <section className="empty-state">
        <h2>Nothing here yet</h2>
        <p>Task sync starts with email in the next milestone.</p>
        <p>
          Signed in as: <strong>{profile?.email ?? 'Loading...'}</strong>
        </p>
        <p>User id: {profile?.id ?? 'Loading...'}</p>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
