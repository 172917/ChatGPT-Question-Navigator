# License Generator Reference

This folder contains a browser-only reference implementation for the legacy
ChatGPT Question Navigator license-token format.

The open-source extension no longer requires activation. This tool is kept so
the signing format, payload structure, and Web Crypto workflow remain auditable
under GPL-3.0.

## What is included

- P-256 ECDSA key-pair generation in the browser.
- License payload creation for a machine code.
- ECDSA/SHA-256 signing.
- The `CQNLIC-<payload>.<signature>` token format.

## What is not included

- No production signing key.
- No certificate, token, password, or paid-release artifact.
- No network request or external service.

## Usage

Open `index.html` in a modern browser, generate a local signing key pair, paste
a machine code, and create a token. The generated key material only exists in
your browser tab unless you copy it out yourself.

If you adapt this for another project, generate and protect your own signing
key. Never commit a production signing key to a public repository.
