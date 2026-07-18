# Vendored libraries

Committed third-party libraries — the single source of truth (nothing is
downloaded at build or install time).

| File | Package | Version | Source |
|---|---|---|---|
| `qrcodegen.js` | [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) | 1.4.4 | https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js |
| `jsQR.js` | [jsqr](https://www.npmjs.com/package/jsqr) | 1.4.0 | https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js |

To upgrade: download the new minified build from the CDN URL (bump the
version), replace the file, update this table, and run `make verify` — the
QR sync round-trip test exercises both libraries end to end.
