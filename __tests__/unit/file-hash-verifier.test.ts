import { describe, it, expect } from 'vitest';
import {
  ALGORITHMS,
  ALGORITHM_BY_LENGTH,
  algorithmFromHash,
  formatBytes,
  fileInfoText,
  hashBlob,
  hashText,
  isHexString,
  normalizeHash,
  verifyHash,
} from '@/tool/types';
import { serializeState, deserializeState, withHistory, roundTrips } from '@/tool/tool-definition';
import { DEFAULT_STATE, MAX_HISTORY, type ToolState } from '@/tool/types';
import { fileHashVerifierTool } from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({
  ...DEFAULT_STATE,
  ...patch,
});

// jsdom provides crypto.subtle via Node's webcrypto in the vitest environment
const subtleAvailable = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';

describe('known vectors', () => {
  it.skipIf(!subtleAvailable)('sha256 of empty string', async () => {
    const digest = await hashText('', 'SHA-256');
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it.skipIf(!subtleAvailable)('sha256 of abc', async () => {
    const digest = await hashText('abc', 'SHA-256');
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it.skipIf(!subtleAvailable)('sha1 of abc', async () => {
    const digest = await hashText('abc', 'SHA-1');
    expect(digest).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it.skipIf(!subtleAvailable)('sha512 of abc', async () => {
    const digest = await hashText('abc', 'SHA-512');
    expect(digest).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
    );
  });

  it.skipIf(!subtleAvailable)('md5 of abc (pure-JS implementation)', async () => {
    const digest = await hashText('abc', 'MD5');
    expect(digest).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it.skipIf(!subtleAvailable)('hashes a Blob like text', async () => {
    const blob = new Blob(['abc']);
    const digest = await hashBlob(blob, 'SHA-256');
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it.skipIf(!subtleAvailable)('reports progress while hashing', async () => {
    const fractions: number[] = [];
    await hashBlob(new Blob(['abc']), 'SHA-256', (fraction) => fractions.push(fraction));
    expect(fractions.at(-1)).toBe(1);
  });
});

describe('normalizeHash', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeHash('  ABCDEF123  ')).toBe('abcdef123');
    expect(normalizeHash('Ba7816Bf')).toBe('ba7816bf');
  });

  it('strips internal whitespace', () => {
    expect(normalizeHash('ab cd ef')).toBe('abcdef');
    expect(normalizeHash('ab\tc\ndef')).toBe('abcdef');
  });

  it('leaves already-normal input untouched', () => {
    const hex = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(normalizeHash(hex)).toBe(hex);
  });
});

describe('verifyHash verdicts', () => {
  const sha256Abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

  it('passes on identical hashes', () => {
    expect(verifyHash(sha256Abc, sha256Abc).verdict).toBe('pass');
  });

  it('is case-insensitive and whitespace-insensitive', () => {
    expect(verifyHash(sha256Abc, sha256Abc.toUpperCase()).verdict).toBe('pass');
    expect(
      verifyHash(sha256Abc, ` ${sha256Abc.slice(0, 32)} ${sha256Abc.slice(32)} `).verdict
    ).toBe('pass');
  });

  it('fails on mismatch', () => {
    const other = sha256Abc.slice(0, 63) + (sha256Abc.endsWith('d') ? 'c' : 'd');
    const verdict = verifyHash(sha256Abc, other);
    expect(verdict.verdict).toBe('fail');
    expect(verdict.algorithmHint).toBeNull();
  });

  it('is incomplete when either side is empty', () => {
    expect(verifyHash('', sha256Abc).verdict).toBe('incomplete');
    expect(verifyHash(sha256Abc, '   ').verdict).toBe('incomplete');
  });

  it('flags expected hashes whose length suggests a different algorithm', () => {
    // 40-char expected (SHA-1 length) against a 64-char SHA-256 computed hash
    const sha1Like = 'a'.repeat(40);
    const verdict = verifyHash(sha256Abc, sha1Like);
    expect(verdict.verdict).toBe('mismatch-algorithm');
    expect(verdict.algorithmHint).toBe('SHA-1');
  });
});

describe('algorithmFromHash', () => {
  it('detects digest algorithms by hex length', () => {
    expect(algorithmFromHash('a'.repeat(32))).toBe('MD5');
    expect(algorithmFromHash('a'.repeat(40))).toBe('SHA-1');
    expect(algorithmFromHash('a'.repeat(64))).toBe('SHA-256');
    expect(algorithmFromHash('a'.repeat(128))).toBe('SHA-512');
  });

  it('is case- and whitespace-tolerant', () => {
    expect(algorithmFromHash(' ' + 'A'.repeat(64) + ' ')).toBe('SHA-256');
  });

  it('returns null for unsupported lengths', () => {
    expect(algorithmFromHash('a'.repeat(10))).toBeNull();
    expect(algorithmFromHash('')).toBeNull();
  });
});

describe('ALGORITHM_BY_LENGTH table', () => {
  it('covers all supported algorithms with canonical lengths', () => {
    expect(ALGORITHMS).toEqual(['MD5', 'SHA-1', 'SHA-256', 'SHA-512']);
    expect(ALGORITHM_BY_LENGTH).toEqual({
      32: 'MD5',
      40: 'SHA-1',
      64: 'SHA-256',
      128: 'SHA-512',
    });
  });
});

describe('isHexString', () => {
  it('accepts hex input with any casing', () => {
    expect(isHexString('DEADBEEF')).toBe(true);
    expect(isHexString('0xdeadbeef')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formats human-readable sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB');
  });

  it('handles invalid input', () => {
    expect(formatBytes(-5)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('fileInfoText', () => {
  it('describes a loaded file', () => {
    const text = fileInfoText('example.iso', 2048, new Date('2026-01-02T03:04:05Z').getTime());
    expect(text).toContain('example.iso');
    expect(text).toContain('2 KB');
    expect(text).toContain('modified');
  });

  it('falls back when no file is loaded', () => {
    expect(fileInfoText('', null, null)).toBe('No file loaded');
  });
});

describe('serialize / deserialize', () => {
  it('round-trips a full state', () => {
    const full = state({
      inputMode: 'text',
      algorithm: 'MD5',
      fileName: 'a.txt',
      fileSize: 5,
      fileLastModified: 1000,
      expectedHash: 'AB CD',
      textInput: 'hello',
      history: [{ text: 'MD5 PASS', createdAt: '2026-01-01T00:00:00Z' }],
    });
    expect(roundTrips(full)).toBe(true);
    expect(serializeState(full)).toContain('"algorithm":"MD5"');
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([]).success).toBe(false);
    expect(deserializeState(42).success).toBe(false);
  });

  it('repairs invalid fields with defaults', () => {
    const repaired = fileHashVerifierTool.deserialize({
      inputMode: 'bogus',
      algorithm: 'SHA3',
      expectedHash: 5,
    });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.inputMode).toBe(DEFAULT_STATE.inputMode);
      expect(repaired.data.algorithm).toBe(DEFAULT_STATE.algorithm);
      expect(repaired.data.expectedHash).toBe('');
    }
  });

  it('caps history at MAX_HISTORY', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `v${i}`,
      createdAt: '2026-01-01T00:00:00Z',
    }));
    const restored = deserializeState({ history: entries });
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.history.length).toBe(MAX_HISTORY);
  });

  it('drops malformed history entries', () => {
    const restored = deserializeState({ history: [{ text: 'ok' }, 'junk', null] });
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.history).toEqual([]);
  });

  it('appends history newest-first with withHistory', () => {
    let s = withHistory(state(), 'first', new Date(0));
    s = withHistory(s, 'second', new Date(1000));
    expect(s.history.map((h) => h.text)).toEqual(['second', 'first']);
    expect(s.history.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it('exposes the configured tool identity', () => {
    expect(fileHashVerifierTool.id).toBe('file-hash-verifier');
    expect(fileHashVerifierTool.name).toBe('File Hash Verifier');
    expect(fileHashVerifierTool.initialState).toEqual(DEFAULT_STATE);
  });
});
