'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  ALGORITHMS,
  algorithmFromHash,
  fileInfoText,
  formatBytes,
  hashBlob,
  hashText,
  normalizeHash,
  verifyHash,
  type HashAlgorithm,
  type InputMode,
  type ToolState,
  type Verdict,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

const VERDICT_STYLES: Record<Verdict, string> = {
  pass: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200',
  fail: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200',
  'mismatch-algorithm':
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  incomplete:
    'border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: '✅ PASS — hashes match',
  fail: '❌ FAIL — hashes do not match',
  'mismatch-algorithm': '❌ FAIL — expected hash looks like a different algorithm',
  incomplete: 'Enter an expected hash to compare',
};

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [computedHash, setComputedHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState(false);
  const [pastedInfo, setPastedInfo] = useState<string>('');

  const expectedAlgo = algorithmFromHash(state.expectedHash);
  const verification = verifyHash(computedHash, state.expectedHash);
  const canCompute =
    state.inputMode === 'file' ? Boolean(state.fileName) : state.textInput.length > 0;

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setError('');
      update({
        inputMode: 'file',
        fileName: file.name,
        fileSize: file.size,
        fileLastModified: file.lastModified,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  const computeHash = useCallback(async () => {
    setError('');
    setComputedHash('');
    setPastedInfo('');
    try {
      let hash: string;
      if (state.inputMode === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError('Select a file first.');
          return;
        }
        hash = await hashBlob(file, state.algorithm, (fraction) => setProgress(fraction));
      } else {
        hash = await hashText(state.textInput, state.algorithm);
        setProgress(1);
      }
      setComputedHash(hash);
      const verdict = verifyHash(hash, state.expectedHash);
      const verdictText =
        state.expectedHash.trim() === ''
          ? `${state.algorithm}: ${hash}`
          : `${state.algorithm} ${verdict.verdict.toUpperCase()}: ${hash}`;
      onSaveHistory?.(verdictText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hashing failed');
    } finally {
      setProgress(null);
    }
  }, [onSaveHistory, state.algorithm, state.expectedHash, state.inputMode, state.textInput]);

  const copyHash = useCallback(async () => {
    if (!computedHash) return;
    try {
      await navigator.clipboard.writeText(computedHash);
      setCopiedHash(true);
      window.setTimeout(() => setCopiedHash(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [computedHash]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      update({ expectedHash: text });
      const normalized = normalizeHash(text);
      const detected = algorithmFromHash(text);
      setPastedInfo(
        detected ? `Detected ${detected} from ${normalized.length} hex characters` : ''
      );
    } catch {
      setError('Clipboard read is unavailable in this browser.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="hash-canvas">
      <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="privacy-note">
        🔒 Files are hashed entirely in your browser and are never uploaded.
      </p>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Input mode selection"
        data-testid="mode-group"
      >
        {(['file', 'text'] as InputMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => update({ inputMode: mode })}
            data-testid={`mode-${mode}`}
            aria-pressed={state.inputMode === mode}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              state.inputMode === mode
                ? 'bg-emerald-500 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {mode === 'file' ? 'File' : 'Text'}
          </button>
        ))}
      </div>

      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        Hash algorithm
        <select
          value={state.algorithm}
          onChange={(e) => update({ algorithm: e.target.value as HashAlgorithm })}
          data-testid="select-algorithm"
          className={inputClass}
        >
          {ALGORITHMS.map((algo) => (
            <option key={algo} value={algo}>
              {algo}
            </option>
          ))}
        </select>
      </label>

      {state.inputMode === 'file' ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          data-testid="drop-zone"
          className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <p>Drag &amp; drop a file here, or</p>
          <input
            ref={fileInputRef}
            type="file"
            data-testid="file-input"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="mt-2 text-xs"
          />
          <p className="mt-2 font-mono text-xs" data-testid="file-info">
            {fileInfoText(state.fileName, state.fileSize, state.fileLastModified)}
          </p>
        </div>
      ) : (
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Text to hash
          <textarea
            value={state.textInput}
            onChange={(e) => update({ textInput: e.target.value })}
            data-testid="text-input"
            rows={5}
            placeholder="Paste text to hash"
            className={inputClass}
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Hash actions">
        <button
          type="button"
          onClick={() => void computeHash()}
          disabled={!canCompute || progress !== null}
          data-testid="btn-compute"
          className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {progress !== null ? `Hashing… ${Math.round(progress * 100)}%` : 'Compute hash'}
        </button>
        <button
          type="button"
          onClick={() =>
            onChange?.({
              ...state,
              fileName: '',
              fileSize: null,
              fileLastModified: null,
              textInput: '',
              expectedHash: '',
            })
          }
          data-testid="btn-clear"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Clear
        </button>
      </div>

      {progress !== null ? (
        <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800" data-testid="progress-bar">
          <div
            className="h-2 rounded bg-emerald-500 transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p
          className="text-xs text-red-600 dark:text-red-400"
          data-testid="error-message"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {computedHash ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          data-testid="computed-box"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Computed {state.algorithm}
            </h3>
            <button
              type="button"
              onClick={() => void copyHash()}
              data-testid="btn-copy-hash"
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {copiedHash ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p
            className="break-all font-mono text-sm text-gray-900 dark:text-gray-100"
            data-testid="computed-hash"
          >
            {computedHash}
          </p>
        </div>
      ) : null}

      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        Expected hash
        <input
          type="text"
          value={state.expectedHash}
          onChange={(e) => update({ expectedHash: e.target.value })}
          data-testid="input-expected"
          placeholder="Paste the known checksum"
          className={inputClass}
        />
        <span className="mt-1 block font-mono text-xs" data-testid="expected-info">
          {state.expectedHash.trim() === ''
            ? ''
            : `${state.expectedHash.trim().length} hex chars${expectedAlgo ? ` · looks like ${expectedAlgo}` : ''}`}
        </span>
      </label>

      <button
        type="button"
        onClick={() => void pasteFromClipboard()}
        data-testid="btn-paste-expected"
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Paste from clipboard
      </button>
      {pastedInfo ? (
        <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="paste-info">
          {pastedInfo}
        </p>
      ) : null}

      {state.expectedHash.trim() !== '' && computedHash ? (
        <div
          className={`rounded-lg border p-3 text-center text-sm font-medium ${VERDICT_STYLES[verification.verdict]}`}
          data-testid="verdict"
          role="status"
        >
          {VERDICT_LABEL[verification.verdict]}
          {verification.algorithmHint ? (
            <span className="mt-1 block text-xs font-normal">
              Expected hash length suggests {verification.algorithmHint}; computed hash is{' '}
              {state.algorithm} ({formatBytes(computedHash.length * 0 + computedHash.length)}{' '}
              chars).
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
