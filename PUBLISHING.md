# Publishing this repository

Everything in this folder is safe to make public: it was built from an allow-list, and it contains **no
API key**. Your key lives outside the project (`~/.config/argumentor/env` or
`%APPDATA%\ArguMentor\env`) and `.gitignore` blocks every `.env` form except `.env.example`.

---

## 1. Push it to GitHub

```bash
cd argumentor-github
git init -b main
git add -A
git commit -m "ArguMentor 4.0.0"
git remote add origin https://github.com/YOUR-USERNAME/argumentor.git
git push -u origin main
```

**Before pushing, confirm nothing key-shaped is staged:**

```bash
git grep -nE 'sk-[A-Za-z0-9]{20,}' -- . || echo "clean"
```

## 2. Turn on GitHub Pages

Repository → **Settings → Pages → Source: GitHub Actions**.

The included workflow (`.github/workflows/pages.yml`) runs the test suite, builds `site/`, **fails the
build if anything key-shaped is present**, and publishes. Your site appears at
`https://YOUR-USERNAME.github.io/argumentor/`.

### What visitors get, with no key anywhere

| | |
|---|---|
| `…/?demo=1` | The full recorded DeepSeek session, replayed read-only |
| `…/` | **Offline template mode** — the real orchestrator, prompts and integrity guard run *in their browser*; feedback comes from fixed templates, and the interface says so |
| Teacher page | Fully working (it was always browser-only) |
| Download link | They run it live with their own key |

That is enough for a colleague to understand and evaluate the whole design without spending anything of
yours.

---

## 3. Optional: real AI feedback on the hosted site

Only if you want visitors to use **your** DeepSeek balance. See [`worker/README.md`](worker/README.md).

In short: deploy the Cloudflare Worker, which holds the key as a **platform secret** — encrypted, never
sent to a browser, never in git, rotatable in seconds. Then set a repository *variable* named
`ARGUMENTOR_API` to the Worker URL and the next push rebuilds the site pointed at it.

The Worker enforces an access code, per-visitor rate limits, and hard daily call and token ceilings.

---

## Why the key is never in the page

A GitHub Pages site is static files. Anything the page can read, every visitor can read — View Source,
devtools, or the repository itself. Minification and obfuscation do not change this.

And DeepSeek bills **one shared prepaid balance with no per-key spending cap and no per-key expiry**, so an
exposed key is not a capped loss — it is the whole balance, including what you need for your own research
runs. Keys committed to public repositories are typically found by automated scrapers within minutes, and
DeepSeek is not a confirmed GitHub secret-scanning partner, so nothing revokes it on your behalf.

If you ever want a visitor to use their own key rather than yours, that is a different feature (each
visitor pastes a key that stays in their own browser) — ask, and it can be added. It would still never put
*your* key in the page.

---

## Release downloads

`npm run package` builds `dist/ArguMentor-v4.0.0.zip` (83 files, no key). Attach it to a GitHub Release so
colleagues can download and run it locally:

Repository → **Releases → Draft a new release** → tag `v4.0.0` → attach the zip.

Link it from the README so the site's download button has somewhere to point.
