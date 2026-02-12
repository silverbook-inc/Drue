import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';

type MeResponse = {
  id?: string;
  email?: string | null;
};

type GmailEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
};

type GmailWatchStartResponse = {
  email: string;
  topic: string;
  historyId: string | null;
  expiration: string | null;
};

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [startingWatch, setStartingWatch] = useState(false);
  const [stoppingWatch, setStoppingWatch] = useState(false);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [watchInfo, setWatchInfo] = useState<GmailWatchStartResponse | null>(null);

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
        const payload = (await response.json().catch(() => ({}))) as { detail?: unknown };
        setError(toErrorMessage(payload.detail, 'Failed to load profile from API.'));
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

  const printFirstFiveEmails = async () => {
    setPrinting(true);
    setError(null);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError('No active session found.');
      setPrinting(false);
      return;
    }

    const response = await fetch(`${env.API_URL}/gmail/print-first-five`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const payload = (await response.json().catch(() => ({}))) as {
      emails?: GmailEmail[];
      count?: number;
      detail?: unknown;
      error?: unknown;
    };

    if (!response.ok) {
      setError(toErrorMessage(payload.detail ?? payload.error, 'Failed to print Gmail emails.'));
      setPrinting(false);
      return;
    }

    setEmails(payload.emails ?? []);
    setPrinting(false);
  };

  const startGmailWatch = async () => {
    setStartingWatch(true);
    setError(null);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError('No active session found.');
      setStartingWatch(false);
      return;
    }

    const response = await fetch(`${env.API_URL}/gmail/watch/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const payload = (await response.json().catch(() => ({}))) as
      | GmailWatchStartResponse
      | { detail?: unknown; error?: unknown };

    if (!response.ok) {
      const maybeErrorPayload = payload as { detail?: unknown; error?: unknown };
      setError(toErrorMessage(maybeErrorPayload.detail ?? maybeErrorPayload.error, 'Failed to start Gmail watch.'));
      setStartingWatch(false);
      return;
    }

    setWatchInfo(payload as GmailWatchStartResponse);
    setStartingWatch(false);
  };

  const stopGmailWatch = async () => {
    setStoppingWatch(true);
    setError(null);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError('No active session found.');
      setStoppingWatch(false);
      return;
    }

    const response = await fetch(`${env.API_URL}/gmail/watch/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown; error?: unknown };
    if (!response.ok) {
      setError(toErrorMessage(payload.detail ?? payload.error, 'Failed to stop Gmail watch.'));
      setStoppingWatch(false);
      return;
    }

    setWatchInfo(null);
    setStoppingWatch(false);
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
        <button onClick={printFirstFiveEmails} className="button primary" disabled={printing}>
          {printing ? 'Loading emails...' : 'Load first 5 emails'}
        </button>
        <button onClick={startGmailWatch} className="button ghost" disabled={startingWatch}>
          {startingWatch ? 'Starting watch...' : 'Start Gmail Watch'}
        </button>
        <button onClick={stopGmailWatch} className="button ghost" disabled={stoppingWatch}>
          {stoppingWatch ? 'Stopping watch...' : 'Stop Gmail Watch'}
        </button>
        {watchInfo ? (
          <div className="email-item">
            <h3>Watch Active</h3>
            <p>
              <strong>Topic:</strong> {watchInfo.topic}
            </p>
            <p>
              <strong>History ID:</strong> {watchInfo.historyId ?? '(none)'}
            </p>
            <p>
              <strong>Expiration:</strong>{' '}
              {watchInfo.expiration ? new Date(Number(watchInfo.expiration)).toISOString() : '(none)'}
            </p>
          </div>
        ) : null}
        {emails.length > 0 ? (
          <div>
            {emails.map((email) => (
              <article key={email.id} className="email-item">
                <h3>{email.subject}</h3>
                <p>
                  <strong>From:</strong> {email.from}
                </p>
                <p>
                  <strong>Date:</strong> {email.date}
                </p>
                <p>{email.snippet || '(no snippet)'}</p>
              </article>
            ))}
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
