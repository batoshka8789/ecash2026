import 'server-only';
import { env } from '@/server/env';

/**
 * AES-256-GCM для куки сессии (Web Crypto). Формат: v1.<iv>.<ciphertext+tag>,
 * base64url. Поддержка SESSION_SECRET_PREVIOUS — расшифровка старым ключом
 * на время ротации; новые куки всегда пишутся текущим ключом.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

let keysPromise: Promise<CryptoKey[]> | null = null;

function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', Buffer.from(b64, 'base64'), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function getKeys(): Promise<CryptoKey[]> {
  if (!keysPromise) {
    const secrets = [env.SESSION_SECRET, env.SESSION_SECRET_PREVIOUS].filter(
      (s): s is string => !!s,
    );
    keysPromise = Promise.all(secrets.map(importKey));
  }
  return keysPromise;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf as Uint8Array).toString('base64url');
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export async function seal(payload: unknown): Promise<string> {
  const [key] = await getKeys();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return `v1.${b64url(iv)}.${b64url(ct)}`;
}

export async function unseal<T>(sealed: string): Promise<T | null> {
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  let iv: Uint8Array, ct: Uint8Array;
  try {
    iv = fromB64url(parts[1]);
    ct = fromB64url(parts[2]);
  } catch {
    return null;
  }
  for (const key of await getKeys()) {
    try {
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ct as BufferSource,
      );
      return JSON.parse(dec.decode(pt)) as T;
    } catch {
      // не этот ключ / повреждена — пробуем следующий
    }
  }
  return null;
}
