## [LRN-20260901-001] release-versioning

**Logged**: 2026-09-01T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: workflow

### Summary
Every extension update must increment the version and be uploaded to GitHub.

### Details
The maintainer requested that bug fixes and future updates always advance the extension version, synchronize the release artifacts, and publish the result to GitHub. CRX files may only be regenerated when the signing key is available.

### Suggested Action
Before each release, update `manifest.json`, version references, the ZIP package, Git tag, and GitHub release; verify tests before pushing.

### Metadata
- Source: user_feedback
- Related Files: manifest.json, README.md, tests/store-manifest.test.js
- Tags: release, versioning, github

---
