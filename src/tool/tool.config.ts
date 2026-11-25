import type { ExportFormat } from '@itsjust/core';

export const toolConfig = {
  id: 'file-hash-verifier',
  name: 'File Hash Verifier',
  category: 'Developer',
  description:
    'Verify file integrity by comparing a computed file checksum (SHA-1/SHA-256/SHA-512/MD5) against an expected hash string.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'] as ExportFormat[],
  theme: {
    accent: '#10b981',
  },
  features: {
    sidebar: true,
    history: true,
    keyboard: true,
    export: true,
    autoSave: true,
    undoRedo: true,
    statusBar: true,
    darkMode: true,
  },
};

export default toolConfig;
