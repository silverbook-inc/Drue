import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TOKEN_FILE = path.resolve(process.cwd(), '.local/gmail_tokens.txt');
const tokenFilePath = process.env.GMAIL_TOKEN_FILE || DEFAULT_TOKEN_FILE;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readTokenMap(): Promise<Map<string, string>> {
  try {
    const content = await readFile(tokenFilePath, 'utf8');
    const map = new Map<string, string>();

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf(':');
      if (separatorIndex <= 0) {
        continue;
      }

      const email = normalizeEmail(line.slice(0, separatorIndex));
      const token = line.slice(separatorIndex + 1).trim();

      if (email && token) {
        map.set(email, token);
      }
    }

    return map;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map();
    }

    throw error;
  }
}

async function writeTokenMap(map: Map<string, string>): Promise<void> {
  await mkdir(path.dirname(tokenFilePath), { recursive: true });

  const lines: string[] = [];
  for (const [email, token] of map.entries()) {
    lines.push(`${email}:${token}`);
  }

  const output = lines.join('\n');
  const tmpPath = `${tokenFilePath}.tmp`;

  await writeFile(tmpPath, output ? `${output}\n` : '', 'utf8');
  await rename(tmpPath, tokenFilePath);
}

export async function saveGmailToken(email: string, token: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = token.trim();

  if (!normalizedEmail || !normalizedToken) {
    throw new Error('Email and token are required');
  }

  const map = await readTokenMap();
  map.set(normalizedEmail, normalizedToken);
  await writeTokenMap(map);
}

export async function findGmailToken(email: string): Promise<string | null> {
  const map = await readTokenMap();
  return map.get(normalizeEmail(email)) ?? null;
}

export function getGmailTokenFilePath(): string {
  return tokenFilePath;
}
