# Security Policy

## Supported versions

GRAVITY is in early development. Only the latest code on `main` (and, once deployed, the live site) receives security fixes.

| Version | Supported |
| --- | --- |
| `main` | ✅ |
| Anything else | ❌ |

## Reporting a vulnerability

**Please do not report security problems in public issues, discussions or pull requests.**

Report privately through GitHub:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (GitHub private vulnerability reporting).
3. Describe the problem, how to reproduce it, and what an attacker could do with it.

If that option is not available, open a public issue that says only "Security contact needed" (no details) and a maintainer will reach out privately.

### What to expect

| Step | Target time |
| --- | --- |
| Acknowledgement | within 3 days |
| Initial assessment | within 7 days |
| Fix or mitigation for confirmed high-severity issues | as soon as practical, usually within 30 days |

We will credit you in the release notes unless you prefer to remain anonymous.

## Scope

In scope: code in this repository and the official GRAVITY deployment.

Out of scope: third-party services (Vercel, Fly.io, Neon, Upstash, NASA websites), social engineering, denial-of-service testing, and automated scans with no demonstrated impact.

## Safe-harbour

We will not take action against good-faith research that avoids privacy violations, data destruction and service disruption, and that gives us reasonable time to fix the problem before public disclosure.

## Our security practices

- No personal data is collected from guest players; display names are filtered and there is no free-text chat.
- All input is validated with Zod; unknown fields are rejected.
- Leaderboard scores are recomputed on the server, never trusted from the client.
- Secrets live only in platform secret stores and git-ignored `.env` files.
- Dependencies are scanned (Dependabot, CodeQL) once CI is set up.

Because the audience includes young players, reports involving child safety or privacy are treated as high priority.
