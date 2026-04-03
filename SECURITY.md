# Security Policy

## Security Model

Word Compiler is designed as a **self-hosted, single-user, localhost application**. It intentionally has no authentication, no rate limiting, and permissive CORS — this is by design for local use.

**Do not expose the server to the public internet or untrusted networks.** The API endpoints include an unauthenticated proxy to the Anthropic API using your configured API key.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Use [GitHub's private vulnerability reporting](https://github.com/2389-research/word-compiler/security/advisories/new) to submit your report.
3. Include steps to reproduce, impact assessment, and any suggested fixes.

We will acknowledge receipt within 72 hours and aim to provide a fix or mitigation plan within 14 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
