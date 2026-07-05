# Security Policy

## Supported Versions

This project is a single Node.js formatter skill with zero runtime
dependencies. The latest tagged GitHub Release is the supported version.
Older releases are not backported — upgrade to the latest tag to receive
fixes.

## Reporting a Vulnerability

This project contains no secrets and no network-facing service. It ships
a Node.js formatter with supporting CI tooling. If you find an issue with
the content or CI configuration, please open a public issue on GitHub.

Do **not** open a public issue if the vulnerability involves the GitHub
Actions workflow (e.g., leaked secrets in CI logs). Report privately to the
repository owner via GitHub's security advisory tool.

## Commit Signing

Maintainer commits from 2026-07-05 onward are SSH-signed. Earlier commits may
be unsigned and are retained to avoid rewriting public history.
