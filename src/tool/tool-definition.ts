import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  ALGORITHMS,
  DEFAULT_ALGORITHM,
  DEFAULT_STATE,
  MAX_HISTORY,
  type HashAlgorithm,
  type HistoryEntry,
  type InputMode,
  type ToolState,
} from './types';

const VALID_MODES: InputMode[] = ['file', 'text'];

function sanitizeAlgorithm(value: unknown): HashAlgorithm {
  return ALGORITHMS.includes(value as HashAlgorithm) ? (value as HashAlgorithm) : DEFAULT_ALGORITHM;
}

function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    inputMode: state.inputMode,
    algorithm: state.algorithm,
    fileName: state.fileName,
    fileSize: state.fileSize,
    fileLastModified: state.fileLastModified,
    expectedHash: state.expectedHash,
    textInput: state.textInput,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected file hash verifier state object',
    };
  }
  const v = data as Record<string, unknown>;
  const state: ToolState = {
    inputMode: VALID_MODES.includes(v.inputMode as InputMode)
      ? (v.inputMode as InputMode)
      : DEFAULT_STATE.inputMode,
    algorithm: sanitizeAlgorithm(v.algorithm),
    fileName: stringOr(v.fileName, DEFAULT_STATE.fileName),
    fileSize: numberOr(v.fileSize, DEFAULT_STATE.fileSize),
    fileLastModified: numberOr(v.fileLastModified, DEFAULT_STATE.fileLastModified),
    expectedHash: stringOr(v.expectedHash, DEFAULT_STATE.expectedHash),
    textInput: stringOr(v.textInput, DEFAULT_STATE.textInput),
    history: sanitizeHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const fileHashVerifierTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};
