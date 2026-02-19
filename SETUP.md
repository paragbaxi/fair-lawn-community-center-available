# Infrastructure & Credentials Setup

Two external services. Everything else is GitHub.

---

## Local Development

```bash
npm install
npm run dev   # http://localhost:5173 (port may bump if taken)
```

Notification features require two env vars that are injected as GitHub Actions secrets in CI but **must be created manually for local dev**:

```bash
# .env.local (gitignored — never commit this file)
VITE_VAPID_PUBLIC_KEY=BD38fbzpEbANyDjOz30kbrY3ICXTsBuNUEwrTrlZdHhsbGzFTbELCFLGCqu9tn2nogdYm-VIzNfyfPN1jdfXMnw
VITE_WORKER_URL=https://flcc-push.trueto.workers.dev
```

Without these, clicking "Turn on notifications" will fail with **"Failed to enable — please try again"**.

The public VAPID key is safe to commit (it's baked into the deployed JS bundle anyway). The worker URL is also public. Neither is a secret — only `VAPID_PRIVATE_KEY` and `NOTIFY_API_KEY` must stay secret.

---

## Services

| Service | Account | What it does |
|---------|---------|-------------|
| **GitHub** | paragbaxi | Code, GitHub Pages (frontend), GitHub Actions (CI + cron) |
| **Cloudflare** | Ghee22@gmail.com | Push notification Worker + KV subscription store |

---

## GitHub Actions Secrets

Set in: repo → Settings → Secrets and variables → Actions

| Secret | Used by workflow | What it is |
|--------|-----------------|------------|
| `CLOUDFLARE_API_TOKEN` | `deploy-worker.yml` | Cloudflare API token — Workers Scripts + KV Storage Edit permissions |
| `VITE_VAPID_PUBLIC_KEY` | `scrape-and-deploy.yml` | VAPID public key (base64url) — baked into the frontend JS bundle at build time |
| `CLOUDFLARE_WORKER_URL` | `scrape-and-deploy.yml`, `push-notify.yml` | Worker base URL, e.g. `https://flcc-push.{subdomain}.workers.dev` (no trailing slash) |
| `NOTIFY_API_KEY` | `push-notify.yml` | Shared secret that authenticates the GitHub Actions script to the Worker's `/notify` endpoint |

**4 secrets total.**

---

## Cloudflare Worker Secrets

Set via: `cd worker && npx wrangler secret put <NAME>`

| Secret | What it is |
|--------|-----------|
| `VAPID_PUBLIC_KEY` | Same value as `VITE_VAPID_PUBLIC_KEY` above — used by the Worker to build push payloads |
| `VAPID_PRIVATE_KEY` | Private half of the VAPID key pair — used to sign push JWTs |
| `NOTIFY_API_KEY` | Same value as `NOTIFY_API_KEY` GitHub secret above |

**3 Worker secrets total.**

Non-secret Worker config (already committed in `worker/wrangler.toml`):
- `APP_ORIGIN` = `https://paragbaxi.github.io`
- `VAPID_SUBJECT` = `https://paragbaxi.github.io/fair-lawn-community-center-available`
- `PAGES_DATA_URL` = `https://paragbaxi.github.io/fair-lawn-community-center-available/data/latest.json`

---

## Cloudflare Resources

| Resource | Name / ID |
|---------|----------|
| Worker | `flcc-push` — `https://flcc-push.trueto.workers.dev` |
| KV Namespace | `SUBSCRIPTIONS` — id `18a2bae93c5f425099d775f27787cab1` |
| Worker cron | `0 12 * * *` (12:00 UTC = 7 AM ET) — daily briefing |

---

## Key Relationships

```
VAPID key pair (generate once):
  private key → Cloudflare Worker secret: VAPID_PRIVATE_KEY
  public key  → Cloudflare Worker secret: VAPID_PUBLIC_KEY
              → GitHub Actions secret:    VITE_VAPID_PUBLIC_KEY  (baked into frontend)

NOTIFY_API_KEY (generate once, any random string):
  → Cloudflare Worker secret: NOTIFY_API_KEY  (Worker checks this on /notify requests)
  → GitHub Actions secret:    NOTIFY_API_KEY  (check-and-notify.mjs sends this header)

CLOUDFLARE_WORKER_URL:
  → GitHub Actions secret:    CLOUDFLARE_WORKER_URL  (check-and-notify.mjs POST target)
  → GitHub Actions secret:    VITE_WORKER_URL alias  (same value, baked into frontend)
```

Note: `CLOUDFLARE_WORKER_URL` is used as `VITE_WORKER_URL` in `scrape-and-deploy.yml`
— they map to the same secret, just referenced under two names.

---

## Bootstrap from Scratch

```bash
# 1. Generate VAPID keys
cd worker && npx web-push generate-vapid-keys

# 2. Set Cloudflare Worker secrets
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put NOTIFY_API_KEY   # use any strong random string

# 3. Deploy the worker (gets the Worker URL)
npx wrangler deploy
# Note the URL printed: https://flcc-push.{subdomain}.workers.dev

# 4. Set GitHub Actions secrets
gh secret set CLOUDFLARE_API_TOKEN     # Cloudflare API token
gh secret set VITE_VAPID_PUBLIC_KEY    # same value as step 1 public key
gh secret set CLOUDFLARE_WORKER_URL    # URL from step 3
gh secret set NOTIFY_API_KEY           # same value as step 2
```

---

## Key Rotation

If `VAPID_PRIVATE_KEY` is ever compromised, **all existing browser subscriptions become invalid** (they are cryptographically tied to the public key). Full rotation procedure:

1. **Clear all KV subscriptions** (they'll be invalid after key change):
   ```bash
   # List all subscription keys
   cd worker && npx wrangler kv key list --binding=SUBSCRIPTIONS
   # Delete each non-idempotent key, or clear the entire namespace via Cloudflare dashboard
   ```

2. **Generate a new VAPID key pair**:
   ```bash
   cd worker && npx web-push generate-vapid-keys
   ```

3. **Set new Worker secrets** (use heredoc to avoid shell mangling of `=`/`/` chars):
   ```bash
   CLOUDFLARE_API_TOKEN="..." npx wrangler secret put VAPID_PUBLIC_KEY << 'EOF'
   <new-public-key>
   EOF
   CLOUDFLARE_API_TOKEN="..." npx wrangler secret put VAPID_PRIVATE_KEY << 'EOF'
   <new-private-key>
   EOF
   ```

4. **Update GitHub Actions secret** `VITE_VAPID_PUBLIC_KEY` to the new public key value.

5. **Trigger a frontend redeploy** to rebake the new public key into the JS bundle:
   ```bash
   gh workflow run "Scrape & Deploy"
   ```

6. **Subscribers must re-subscribe** — existing push subscriptions will be cleaned up automatically (Worker returns 410 cleanup) when the next notification attempt fails.

> **Note**: Set secrets AFTER the worker is already deployed. Secrets set when no worker exists ("no worker found" wrangler warning) do NOT persist to the live worker.
