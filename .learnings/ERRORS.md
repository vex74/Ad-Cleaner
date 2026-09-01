## [ERR-20260901-001] github-auth

**Logged**: 2026-09-01T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: release

### Summary
GitHub CLI authentication for account `vex74` is invalid.

### Error
`gh auth status` reported that the active token for `vex74` is invalid and requested `gh auth login -h github.com`.

### Context
- Operation attempted: verify GitHub authentication before publishing version `0.9.29`
- Repository: `vex74/Ad-Cleaner`

### Suggested Fix
Re-authenticate GitHub CLI, then push the `v0.9.29` tag and create the release with the ZIP asset.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/LEARNINGS.md`

---

## [ERR-20260901-002] git-push

**Logged**: 2026-09-01T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: release

### Summary
Pushing to GitHub did not return and had to be stopped.

### Error
`git push origin main v0.9.29` produced no output and remained running until interrupted. A second attempt with `GIT_TERMINAL_PROMPT=0` behaved the same way.

### Context
- Repository: `vex74/Ad-Cleaner`
- Local commit: `c0d0683`
- Local tag: `v0.9.29`
- GitHub CLI authentication is already known to be invalid.

### Suggested Fix
Re-authenticate GitHub credentials, then push `main` and `v0.9.29`, followed by creating the GitHub release with the ZIP asset.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`

---
