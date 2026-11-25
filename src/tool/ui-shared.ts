import { DEFAULT_ALGORITHM, type HashAlgorithm, type ToolState } from './types';

/** One-line status text for the current tool state. */
export function summaryText(state: ToolState): string {
  const label: HashAlgorithm = state.algorithm ?? DEFAULT_ALGORITHM;
  return `${label} ready — select a file or paste text to compute`;
}
