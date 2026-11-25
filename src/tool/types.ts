export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';

export type InputMode = 'file' | 'text';

export interface HistoryEntry {
  /** Short human readable description of the verification. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Active input mode: hash a file or a pasted text. */
  inputMode: InputMode;
  /** Selected hash algorithm. */
  algorithm: HashAlgorithm;
  /** Name of the loaded file (informational only; file content never stored). */
  fileName: string;
  /** File size in bytes, or null when no file is loaded. */
  fileSize: number | null;
  /** File last-modified timestamp (ms epoch), or null. */
  fileLastModified: number | null;
  /** Expected/known checksum that the computed hash is compared against. */
  expectedHash: string;
  /** Text to hash in text mode. */
  textInput: string;
  /** Saved verification history, newest first. */
  history: HistoryEntry[];
}

export const MAX_HISTORY = 10;

export const ALGORITHMS: HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];

export const DEFAULT_ALGORITHM: HashAlgorithm = 'SHA-256';

export const DEFAULT_STATE: ToolState = {
  inputMode: 'file',
  algorithm: DEFAULT_ALGORITHM,
  fileName: '',
  fileSize: null,
  fileLastModified: null,
  expectedHash: '',
  textInput: '',
  history: [],
};

/** Hex digest lengths for MD5, SHA-1, SHA-256, SHA-512 respectively. */
export const ALGORITHM_BY_LENGTH: Record<number, HashAlgorithm> = {
  32: 'MD5',
  40: 'SHA-1',
  64: 'SHA-256',
  128: 'SHA-512',
};

/** Normalize a pasted hash: trim whitespace and lowercase. */
export function normalizeHash(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '');
}

/** Detect a hash algorithm from a hex digest's length; null when unsupported. */
export function algorithmFromHash(input: string): HashAlgorithm | null {
  return ALGORITHM_BY_LENGTH[normalizeHash(input).length] ?? null;
}

/** True when the input looks like a full hex digest of a supported algorithm. */
export function isHexString(input: string): boolean {
  return /^[0-9a-f]+$/i.test(normalizeHash(input));
}

export type Verdict = 'pass' | 'fail' | 'mismatch-algorithm' | 'incomplete';

export interface Verification {
  verdict: Verdict;
  /** True when the expected hash length matches a different algorithm's digest. */
  algorithmHint: HashAlgorithm | null;
}

/**
 * Compare a computed hash against the expected hash.
 * Case-insensitive and whitespace-insensitive. When the expected hash length
 * matches a different algorithm the verdict is flagged with a hint.
 */
export function verifyHash(computed: string, expected: string): Verification {
  const comp = normalizeHash(computed);
  const exp = normalizeHash(expected);
  if (!comp || !exp) return { verdict: 'incomplete', algorithmHint: null };
  const expectedAlgo = algorithmFromHash(exp);
  let algorithmHint: HashAlgorithm | null = null;
  if (expectedAlgo && comp.length !== exp.length) {
    algorithmHint = expectedAlgo;
  }
  if (comp === exp) return { verdict: 'pass', algorithmHint };
  if (algorithmHint) return { verdict: 'mismatch-algorithm', algorithmHint };
  return { verdict: 'fail', algorithmHint };
}

/** Format a byte count in human-readable units. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    value /= 1024;
    unit = next;
    if (value < 1024) break;
  }
  return `${value >= 100 ? Math.round(value) : Number(value.toFixed(1))} ${unit}`;
}

/** Human file info line, or placeholder when no file is loaded. */
export function fileInfoText(
  fileName: string,
  fileSize: number | null,
  fileLastModified: number | null
): string {
  if (!fileName || fileSize === null) return 'No file loaded';
  const size = formatBytes(fileSize);
  const modified =
    fileLastModified !== null ? new Date(fileLastModified).toLocaleString() : 'unknown';
  return `${fileName} · ${size} · modified ${modified}`;
}

/** Progressively hash a Blob/File using Web Crypto (MD5 uses a pure-JS impl). */
export async function hashBlob(
  blob: Blob,
  algorithm: HashAlgorithm,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const digest = await digestBlob(blob, algorithm, onProgress);
  return bytesToHex(digest);
}

/** Hash arbitrary text via TextEncoder (same code path as file hashing). */
export async function hashText(text: string, algorithm: HashAlgorithm): Promise<string> {
  return hashBlob(new Blob([text]), algorithm);
}

async function digestBlob(
  blob: Blob,
  algorithm: HashAlgorithm,
  onProgress?: (fraction: number) => void
): Promise<Uint8Array> {
  if (algorithm === 'MD5') return md5Digest(blob, onProgress);
  const algo = algorithm === 'SHA-1' ? 'SHA-1' : algorithm; // SHA-256/512 pass through
  const chunkSize = 8 * 1024 * 1024;
  if (blob.size <= chunkSize) {
    onProgress?.(1);
    return new Uint8Array(await crypto.subtle.digest(algo, await blob.arrayBuffer()));
  }
  // Web Crypto cannot stream, so hash the full buffer while reporting progress.
  const buffer = await readWithProgress(blob, onProgress);
  return new Uint8Array(await crypto.subtle.digest(algo, buffer));
}

async function readWithProgress(
  blob: Blob,
  onProgress?: (fraction: number) => void
): Promise<ArrayBuffer> {
  if (typeof blob.stream !== 'function') {
    const buffer = await blob.arrayBuffer();
    onProgress?.(1);
    return buffer;
  }
  const total = blob.size;
  const reader = blob.stream().getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(Math.min(1, received / total));
    }
  }
  onProgress?.(1);
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/* ------------------------------------------------------------------ */
/* Pure-JS MD5 (Web Crypto does not support MD5)                       */
/* ------------------------------------------------------------------ */

async function md5Digest(blob: Blob, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
  const data = new Uint8Array(await readWithProgress(blob, onProgress));
  return md5Bytes(data);
}

function md5Bytes(data: Uint8Array): Uint8Array {
  const len = data.length;
  const bitLen = len * 8;
  // message with padding: data + 0x80 + zeros + 8-byte little-endian bit length
  const paddedLen = ((len + 8) >>> 6) * 64 + 64;
  const message = new Uint8Array(paddedLen);
  message.set(data);
  message[len] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(chunk + i * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i]! + M[g]!) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, s[i]!)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, i) => outView.setUint32(i * 4, word, true));
  return out;
}

function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

export { bytesToHex };
