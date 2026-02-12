import { Router } from "express";
import { env } from "../env.js";
import { requireAuth } from "../middleware/auth.js";
import { findGmailToken, saveGmailToken } from "../lib/gmailTokenStore.js";

const gmailRouter = Router();

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
};

type GmailPushData = {
  emailAddress?: string;
  historyId?: string;
};

type GmailHistoryRecord = {
  id?: string;
  messagesAdded?: Array<{
    message?: {
      id?: string;
      threadId?: string;
    };
  }>;
};

type GmailHistoryResponse = {
  history?: GmailHistoryRecord[];
  historyId?: string;
  nextPageToken?: string;
};

type GmailMessagePart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailFullMessage = {
  id?: string;
  snippet?: string;
  payload?: {
    headers?: GmailMessageHeader[];
    parts?: GmailMessagePart[];
    body?: {
      data?: string;
    };
  };
};

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractPlainTextBody(part?: GmailMessagePart): string | null {
  if (!part) {
    return null;
  }

  if (part.mimeType === "text/plain" && part.body?.data) {
    try {
      return decodeBase64Url(part.body.data);
    } catch {
      return null;
    }
  }

  for (const child of part.parts ?? []) {
    const nested = extractPlainTextBody(child);
    if (nested) {
      return nested;
    }
  }

  return null;
}

async function processPubSubHistoryEvent(pushData: GmailPushData): Promise<void> {
  const email = pushData.emailAddress;
  const notificationHistoryId = pushData.historyId;

  if (!email || !notificationHistoryId) {
    return;
  }

  const savedToken = await findGmailToken(email);
  if (!savedToken) {
    console.warn("[GMAIL_PUBSUB] no saved token for email", { email });
    return;
  }

  if (savedToken.startsWith("ya29.")) {
    console.warn("[GMAIL_PUBSUB] saved token is access token; need refresh token", { email });
    return;
  }

  const accessToken = await exchangeRefreshTokenForAccessToken(savedToken);
  // Stateless mode: fetch recent history from the incoming notification point only.
  // Gmail history.list expects a starting point "after" the provided id, so subtract 1 when possible.
  const startHistoryId = (() => {
    try {
      const value = BigInt(notificationHistoryId);
      return value > 1n ? (value - 1n).toString() : notificationHistoryId;
    } catch {
      console.log("error in history ID");
      return notificationHistoryId;
    }
  })();

  let pageToken: string | undefined;
  let latestHistoryId: string | undefined = notificationHistoryId;
  const allHistoryRecords: GmailHistoryRecord[] = [];

  do {
    const query = new URLSearchParams({
      startHistoryId,
    });
    if (pageToken) {
      query.set("pageToken", pageToken);
    }

    const historyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const historyPayload = (await historyResponse
      .json()
      .catch(() => ({}))) as GmailHistoryResponse & {
      error?: unknown;
    };

    if (!historyResponse.ok) {
      console.error("[GMAIL_PUBSUB] failed to pull history", {
        email,
        startHistoryId,
        detail: historyPayload.error ?? historyPayload,
      });
      return;
    }

    if (historyPayload.history?.length) {
      allHistoryRecords.push(...historyPayload.history);
    }

    latestHistoryId = historyPayload.historyId ?? latestHistoryId;
    pageToken = historyPayload.nextPageToken;
  } while (pageToken);

  const messagesAdded = allHistoryRecords.flatMap((record) =>
    (record.messagesAdded ?? []).map((entry) => ({
      historyId: record.id ?? null,
      messageId: entry.message?.id ?? null,
      threadId: entry.message?.threadId ?? null,
    })),
  );

  const newMessageIds = [
    ...new Set(messagesAdded.map((item) => item.messageId).filter(Boolean)),
  ] as string[];
  if (newMessageIds.length === 0) {
    console.log("no new messages?");
    return;
  }

  for (const messageId of newMessageIds) {
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const messagePayload = (await messageResponse.json().catch(() => ({}))) as GmailFullMessage & {
      error?: unknown;
    };

    if (!messageResponse.ok) {
      console.error("[GMAIL_PUBSUB] failed to fetch new message", {
        email,
        messageId,
        detail: messagePayload.error ?? messagePayload,
      });
      continue;
    }

    const headers = messagePayload.payload?.headers;
    const subject = pickHeader(headers, "Subject");
    const from = pickHeader(headers, "From");
    const date = pickHeader(headers, "Date");
    const body =
      extractPlainTextBody({
        mimeType: messagePayload.payload?.parts ? "multipart/mixed" : "text/plain",
        parts: messagePayload.payload?.parts,
        body: messagePayload.payload?.body,
      }) ??
      messagePayload.snippet ??
      "(no body)";

    console.log("[GMAIL_PUBSUB] new email received", {
      email,
      messageId,
      from,
      subject,
      date,
      body,
    });
  }
}

gmailRouter.post("/pubsub/webhook", (req, res) => {
  const payload = req.body as PubSubPushBody;
  const base64Data = payload.message?.data;

  if (!base64Data) {
    // Ack malformed events to avoid redelivery loops while prototyping.
    res.status(204).send();
    return;
  }

  try {
    const decoded = Buffer.from(base64Data, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as GmailPushData;

    console.log("[GMAIL_PUBSUB] event received", {
      subscription: payload.subscription ?? null,
      messageId: payload.message?.messageId ?? null,
      publishTime: payload.message?.publishTime ?? null,
      emailAddress: parsed.emailAddress ?? null,
      historyId: parsed.historyId ?? null,
    });

    // Ack first, then process history asynchronously.
    res.status(204).send();
    void processPubSubHistoryEvent(parsed);
  } catch (error) {
    console.error("[GMAIL_PUBSUB] failed to decode event", {
      detail: (error as Error).message,
    });
    res.status(204).send();
  }
});

gmailRouter.post("/token", requireAuth, async (req, res) => {
  const email = req.user?.email;
  const token = req.body?.token;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Authenticated user email is required to store token" });
    return;
  }

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Request body must include token string" });
    return;
  }

  try {
    await saveGmailToken(email, token);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to save Gmail token",
      detail: (error as Error).message,
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
  return header?.value ?? "(none)";
}

async function exchangeRefreshTokenForAccessToken(refreshToken: string): Promise<string> {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error ?? "Failed to exchange refresh token");
  }

  return tokenPayload.access_token;
}

gmailRouter.post("/print-first-five", requireAuth, async (req, res) => {
  const email = req.user?.email;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Authenticated user email is required" });
    return;
  }

  try {
    const savedToken = await findGmailToken(email);

    if (!savedToken) {
      res.status(404).json({ error: "No stored Gmail token found for user" });
      return;
    }

    if (savedToken.startsWith("ya29.")) {
      res.status(400).json({
        error: "Stored token is an access token; expected refresh token",
        detail: "Re-login so Drue can persist a Google refresh token.",
      });
      return;
    }

    // Always mint a fresh access token to avoid expired-token failures.
    const accessToken = await exchangeRefreshTokenForAccessToken(savedToken);

    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!listResponse.ok) {
      const listError = (await listResponse.json().catch(() => ({}))) as { error?: unknown };
      res
        .status(502)
        .json({ error: "Failed to list Gmail messages", detail: listError.error ?? null });
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
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!messageResponse.ok) {
          return {
            id,
            subject: "(failed to load)",
            from: "(failed to load)",
            date: "(failed to load)",
            snippet: "",
          };
        }

        const metadata = (await messageResponse.json()) as GmailMessageMetadata;
        const headers = metadata.payload?.headers;
        return {
          id,
          subject: pickHeader(headers, "Subject"),
          from: pickHeader(headers, "From"),
          date: pickHeader(headers, "Date"),
          snippet: metadata.snippet ?? "",
        };
      }),
    );

    const emails = metadataResults.filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry),
    );
    res.json({ emails, count: emails.length });
  } catch (error) {
    res.status(500).json({
      error: "Failed to print Gmail messages",
      detail: (error as Error).message,
    });
  }
});

gmailRouter.post("/watch/start", requireAuth, async (req, res) => {
  const email = req.user?.email;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Authenticated user email is required" });
    return;
  }

  if (!env.gmailPubsubTopic) {
    res.status(500).json({
      error: "Missing GMAIL_PUBSUB_TOPIC",
      detail: "Set GMAIL_PUBSUB_TOPIC in apps/api/.env",
    });
    return;
  }

  try {
    const savedToken = await findGmailToken(email);

    if (!savedToken) {
      res.status(404).json({ error: "No stored Gmail token found for user" });
      return;
    }

    if (savedToken.startsWith("ya29.")) {
      res.status(400).json({
        error: "Stored token is an access token; expected refresh token",
        detail: "Re-login so Drue can persist a Google refresh token.",
      });
      return;
    }

    const accessToken = await exchangeRefreshTokenForAccessToken(savedToken);
    const watchResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        topicName: env.gmailPubsubTopic,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      }),
    });

    const watchPayload = (await watchResponse.json().catch(() => ({}))) as {
      historyId?: string;
      expiration?: string;
      error?: unknown;
    };

    if (!watchResponse.ok) {
      res.status(502).json({
        error: "Failed to start Gmail watch",
        detail: watchPayload.error ?? watchPayload,
      });
      return;
    }

    res.json({
      email,
      topic: env.gmailPubsubTopic,
      historyId: watchPayload.historyId ?? null,
      expiration: watchPayload.expiration ?? null,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to start Gmail watch",
      detail: (error as Error).message,
    });
  }
});

gmailRouter.post("/watch/stop", requireAuth, async (req, res) => {
  const email = req.user?.email;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Authenticated user email is required" });
    return;
  }

  try {
    const savedToken = await findGmailToken(email);

    if (!savedToken) {
      res.status(404).json({ error: "No stored Gmail token found for user" });
      return;
    }

    if (savedToken.startsWith("ya29.")) {
      res.status(400).json({
        error: "Stored token is an access token; expected refresh token",
        detail: "Re-login so Drue can persist a Google refresh token.",
      });
      return;
    }

    const accessToken = await exchangeRefreshTokenForAccessToken(savedToken);
    const stopResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/stop", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const stopPayload = (await stopResponse.json().catch(() => ({}))) as {
      error?: unknown;
    };

    if (!stopResponse.ok) {
      res.status(502).json({
        error: "Failed to stop Gmail watch",
        detail: stopPayload.error ?? stopPayload,
      });
      return;
    }

    res.json({
      email,
      stopped: true,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to stop Gmail watch",
      detail: (error as Error).message,
    });
  }
});

export default gmailRouter;
