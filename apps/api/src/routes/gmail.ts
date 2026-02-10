import { Router } from 'express';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { findGmailToken, saveGmailToken } from '../lib/gmailTokenStore.js';

const gmailRouter = Router();

gmailRouter.post('/token', requireAuth, async (req, res) => {
  const email = req.user?.email;
  const token = req.body?.token;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Authenticated user email is required to store token' });
    return;
  }

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Request body must include token string' });
    return;
  }

  try {
    await saveGmailToken(email, token);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'Failed to save Gmail token',
      detail: (error as Error).message
    });
  }
});

type GmailListItem = {
  id?: string;
};

type GmailMessageHeader = {
  name?: string;
  value?: string;
};

type GmailMessageMetadata = {
  id?: string;
  snippet?: string;
  payload?: {
    headers?: GmailMessageHeader[];
  };
};

function pickHeader(headers: GmailMessageHeader[] | undefined, name: string): string {
  const header = headers?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? '(none)';
}

async function exchangeRefreshTokenForAccessToken(refreshToken: string): Promise<string> {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string; error?: string };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error ?? 'Failed to exchange refresh token');
  }

  return tokenPayload.access_token;
}

gmailRouter.post('/print-first-five', requireAuth, async (req, res) => {
  const email = req.user?.email;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Authenticated user email is required' });
    return;
  }

  try {
    const savedToken = await findGmailToken(email);

    if (!savedToken) {
      res.status(404).json({ error: 'No stored Gmail token found for user' });
      return;
    }

    if (savedToken.startsWith('ya29.')) {
      res.status(400).json({
        error: 'Stored token is an access token; expected refresh token',
        detail: 'Re-login so Drue can persist a Google refresh token.'
      });
      return;
    }

    // Always mint a fresh access token to avoid expired-token failures.
    const accessToken = await exchangeRefreshTokenForAccessToken(savedToken);

    const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!listResponse.ok) {
      const listError = (await listResponse.json().catch(() => ({}))) as { error?: unknown };
      res.status(502).json({ error: 'Failed to list Gmail messages', detail: listError.error ?? null });
      return;
    }

    const listPayload = (await listResponse.json()) as { messages?: GmailListItem[] };
    const messages = listPayload.messages ?? [];

    const metadataResults = await Promise.all(
      messages.map(async (message) => {
        const id = message.id;
        if (!id) {
          return null;
        }

        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );

        if (!messageResponse.ok) {
          return { id, subject: '(failed to load)', from: '(failed to load)', date: '(failed to load)', snippet: '' };
        }

        const metadata = (await messageResponse.json()) as GmailMessageMetadata;
        const headers = metadata.payload?.headers;
        return {
          id,
          subject: pickHeader(headers, 'Subject'),
          from: pickHeader(headers, 'From'),
          date: pickHeader(headers, 'Date'),
          snippet: metadata.snippet ?? ''
        };
      })
    );

    const emails = metadataResults.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    res.json({ emails, count: emails.length });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to print Gmail messages',
      detail: (error as Error).message
    });
  }
});

export default gmailRouter;
