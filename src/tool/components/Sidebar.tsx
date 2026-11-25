'use client';

import React from 'react';
import type { ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="hash-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Current input</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li className="flex justify-between gap-2">
            <span>Mode</span>
            <span className="text-gray-500 dark:text-gray-400">{state.inputMode}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Algorithm</span>
            <span className="text-gray-500 dark:text-gray-400">{state.algorithm}</span>
          </li>
          {state.inputMode === 'file' && state.fileSize !== null ? (
            <li className="flex justify-between gap-2">
              <span>File size</span>
              <span className="text-gray-500 dark:text-gray-400">{state.fileSize} bytes</span>
            </li>
          ) : null}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Verifications</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} saved verification{state.history.length === 1 ? '' : 's'}
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">How it works</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          MD5, SHA-1, SHA-256 and SHA-512 digests are computed locally: Web Crypto for the SHA
          family and a built-in implementation for MD5. Comparison trims whitespace and ignores
          case, so `ABC123…` matches `abc123…`.
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Privacy</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Files never leave your browser. Nothing is uploaded, stored on a server, or included in
          shared URLs — only algorithm choice, expected hash, and pasted text travel in share links.
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current input mode, algorithm,
          and expected hash; open it to restore this setup.
        </p>
      </div>
    </div>
  );
};
