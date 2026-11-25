# File Hash Verifier

Verify file integrity by comparing a computed file checksum (MD5/SHA-1/SHA-256/SHA-512) against an expected hash string.

**Live:** [file-hash-verifier.itsjust.tools](https://file-hash-verifier.itsjust.tools)

## Features

- Drag-and-drop or file-picker input, hashed fully client-side — files never leave your browser
- Algorithm selection: MD5, SHA-1, SHA-256, SHA-512 (Web Crypto for the SHA family, built-in MD5)
- Progressive hashing for large files with a live progress bar
- Expected-hash input with whitespace and case normalization
- Clear PASS/FAIL verdict, with a hint when the expected hash length suggests a different algorithm
- Copy the computed hash to the clipboard and paste-detect a hash's algorithm from its length
- File info: name, human-readable size, and last-modified date
- Text mode: paste text and hash it instead of a file
- Shareable state via URL, `.itsjust.json` import/export and image/PDF export
- 100% client-side — no data ever leaves your browser

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-file-hash-verifier .
docker run -p 3000:3000 itsjust-file-hash-verifier
```

## License

MIT
