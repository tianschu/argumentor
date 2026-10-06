#  Hosted back end (optional)

This folder makes the public site give **real AI feedback on your DeepSeek balance** without putting your
key anywhere a visitor can read it. Skip it entirely if you are happy with the demo-and-offline site.

## Why not just put the key in the page?

A GitHub Pages site is static files. Anything the page can read, every visitor can read — View Source,
devtools, or the repository itself. And DeepSeek bills **one shared prepaid balance with no per-key
spending cap or expiry**, so an exposed key is not a capped loss, it is the whole balance, including what
you need for your own research runs. A key committed to a public repo is typically found by scrapers
within minutes, and DeepSeek is not a confirmed GitHub secret-scanning partner, so nothing revokes it for
you.

Here the key is a **platform secret**: encrypted at rest, never returned to a browser, never in git, and
rotatable in seconds without touching the site.

## Deploy (about five minutes, free tier)

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create ARGUMENTOR_KV    # recommended; see "Caps" below
```

Paste the printed id into `wrangler.toml` (uncomment the `[[kv_namespaces]]` block), set
`ALLOWED_ORIGIN` to your site's URL, then:

Check the config first (reads the local file only, contacts nothing):

```bash
node preflight.mjs
```

Then:

```bash
npx wrangler secret put DEEPSEEK_API_KEY   # paste at the prompt; it is not echoed or stored locally
npx wrangler secret put ACCESS_CODE        # a short code you give to colleagues
npx wrangler deploy
```

Point the site at it and republish:

```bash
cd ..
node build-site.mjs --api https://argumentor.YOUR-SUBDOMAIN.workers.dev
```

Visitors are asked for the access code once per browser session.

## What protects your balance

| Control | Where | Effect |
|---|---|---|
| `ACCESS_CODE` | secret | without it, every call is refused with 401 |
| `ALLOWED_ORIGIN` | `wrangler.toml` | only your site may call it from a browser |
| Per-visitor rate limit | code | 6 reviews / 40 dialogue turns / 10 checks per 10 minutes |
| `MAX_DAILY_CALLS` | `wrangler.toml` | refuses once reached, until the next UTC day |
| `MAX_DAILY_TOKENS` | `wrangler.toml` | same, measured in tokens actually spent |
| Prepaid balance | DeepSeek | the ultimate ceiling — keep it small while the site is public |

**Caps and KV.** With a KV namespace bound, the daily counters are shared and the cap holds. Without KV
they live in per-isolate memory, so Cloudflare running several isolates can let the real total drift above
the cap. Bind KV before you publish the link widely.

**This is still your money.** Treat the access code as the real gate, keep the DeepSeek balance low, and
watch the usage page for the first few days. Rotate with `npx wrangler secret put DEEPSEEK_API_KEY`.

## What it runs

The same `orchestrator.mjs`, `prompts.mjs` and `guard.mjs` as the local server — one import away in the
parent folder — so hosted feedback is identical to `npm start`, including the integrity guard, the
anchor verification and the provenance stamped on every round. The Worker adds no prompt of its own.
