# Step-by-step deployment

Follow this top to bottom. Nothing here is hard, but the order matters: GitHub first, because Cloudflare
needs to know your site's address.

---

## First, the thing that confuses everyone

**GitHub and Cloudflare are two different companies, doing two different jobs.**

```
   GitHub                              Cloudflare
   ──────                              ──────────
   Hosts the web page                  Holds your API key
   (free, static files)                (free tier, runs code)

   argumentor.github.io  ──fetch──▶    argumentor.workers.dev  ──▶  DeepSeek
   HTML, CSS, JavaScript               the key lives ONLY here
   NO key, ever
```

`wrangler.toml` is a **Cloudflare** file. It happens to sit inside your GitHub repository folder for
convenience, but GitHub never reads it. Its full path on your Mac:

```
/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github/worker/wrangler.toml
```

**Wrangler** is Cloudflare's command-line tool. You do not install it — `npx wrangler …` downloads and
runs it on demand.

You can stop after Part A if you only want the demo site. Parts B and C are only for real AI feedback
paid from your DeepSeek balance.

---

## Part A · Put the site on GitHub

### A1. Fix your git identity (one minute, do this first)

Your global git config currently says `你的名字 <你的邮箱>`, which would appear publicly on every commit.

Pick a name, then decide on the email:

- **Recommended — keep your real address private.** GitHub gives you a noreply address. After creating
  your account, find it at **Settings → Emails → "Keep my email addresses private"**. It looks like
  `12345678+yourusername@users.noreply.github.com`.
- Or use a real address you don't mind being public.

```bash
git config --global user.name "Your Name"
git config --global user.email "12345678+yourusername@users.noreply.github.com"
```

Then rewrite the two existing commits so they carry the new identity:

```bash
cd '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github'
git rebase --root --exec 'git commit --amend --no-edit --reset-author'
git log --format='%h %an <%ae>'
```

Both lines should now show your chosen name and email.

### A2. Create the repository on GitHub

1. Go to <https://github.com/new>.
2. **Repository name:** `argumentor` (use something else if you prefer, but remember it — it becomes part
   of your site's address).
3. **Public.** Pages needs this on the free plan, and the whole point is that colleagues can see it.
4. **Do not** tick "Add a README", "Add .gitignore" or "Choose a license". Your folder already has
   everything, and an extra file here causes a conflict on the first push.
5. Click **Create repository**.

### A3. Push

GitHub will show you a page of commands — ignore it and use these, which match your existing folder:

```bash
cd '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github'
git remote add origin https://github.com/YOUR-USERNAME/argumentor.git
git push -u origin main
```

**About the password prompt.** GitHub stopped accepting account passwords for git in 2021. When it asks:

- **Username:** your GitHub username
- **Password:** a **Personal Access Token**, not your password

Create one at <https://github.com/settings/tokens> → **Generate new token (classic)** → tick the **`repo`**
scope → set an expiry → **Generate**. Copy it immediately (it is shown once) and paste it at the password
prompt. macOS Keychain will remember it.

> If `git push` fails with "Support for password authentication was removed", that is exactly this — you
> used the account password instead of a token.

### A4. Turn on GitHub Pages

In your repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

That is the only setting. The workflow is already in your repo, and it will:

1. run all 71 tests,
2. build the static site,
3. **fail the build if anything that looks like an API key is present**,
4. publish.

Watch it under the **Actions** tab. The first run takes a minute or two. When the green tick appears, your
site is live at:

```
https://YOUR-USERNAME.github.io/argumentor/
```

**Write that address down. Part B needs it exactly, including `https://` and with no trailing slash.**

### A5. Check it

Open the address. You should see the studio with a note saying it is a public demo build. Try:

- `https://YOUR-USERNAME.github.io/argumentor/?demo=1` — the recorded real DeepSeek session.
- The plain address — offline mode: you can type your own argument and get a full four-role review that
  runs *in your browser*, with template feedback.

**You are done if that is enough.** Everything below is only to add real AI feedback paid from your balance.

---

## Part B · Deploy the Worker on Cloudflare

This is where your API key goes. It is stored encrypted by Cloudflare, never sent to a browser, never in
your repository, and you can replace it at any time.

### B1. Create a free Cloudflare account

<https://dash.cloudflare.com/sign-up>. Email and password; **no credit card, no domain name needed**.
Verify the email before continuing.

### B2. Log wrangler in

```bash
cd '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github/worker'
npx wrangler login
```

The first time, npm asks to install the `wrangler` package — answer `y`. Your browser opens; click
**Allow**. Back in the terminal you should see `Successfully logged in`.

### B3. Create the KV namespace

This is what makes the daily spending cap reliable. Do not skip it.

```bash
npx wrangler kv namespace create ARGUMENTOR_KV
```

It prints something like:

```
[[kv_namespaces]]
binding = "ARGUMENTOR_KV"
id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
```

**Copy that `id` value.** You need it in the next step.

### B4. Edit `wrangler.toml`

Open it in any text editor:

```bash
open -e '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github/worker/wrangler.toml'
```

Make **two** changes.

**(1) Your site's address.** Find this line:

```toml
ALLOWED_ORIGIN = "https://YOUR-USERNAME.github.io"
```

Replace it with the address from step A4 — **origin only**, so no repository name, no trailing slash:

```toml
ALLOWED_ORIGIN = "https://cts.github.io"
```

> This is the one people get wrong. If your site is at `https://cts.github.io/argumentor/`, the origin is
> `https://cts.github.io` — stop at the first single slash after the domain.

**(2) The KV namespace.** Find these three commented lines near the bottom:

```toml
# [[kv_namespaces]]
# binding = "ARGUMENTOR_KV"
# id = "paste-the-id-wrangler-prints"
```

Remove the `#` and the space from each, and paste your real id:

```toml
[[kv_namespaces]]
binding = "ARGUMENTOR_KV"
id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
```

Optionally lower the daily ceilings while you are testing — these are hard limits on your spending:

```toml
MAX_DAILY_CALLS = "100"
MAX_DAILY_TOKENS = "500000"
```

Save the file.

### B4b. Check your config before going further

```bash
node preflight.mjs
```

It reads `wrangler.toml` only — it contacts nothing and never touches your key. It catches the two
mistakes almost everyone makes (an origin with a path on the end, and a forgotten KV namespace), and
refuses if a key has somehow ended up in the file. Fix anything marked ✗ and run it again until it says
**Ready**.

### B5. Store the secrets

**These two commands are the only place your key is handled. Nothing is written to your repository.**

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

Paste your DeepSeek key at the prompt and press Enter. It is not echoed and not saved locally.

```bash
npx wrangler secret put ACCESS_CODE
```

Type a short code of your choosing — for example `arg-2026` — and press Enter. Colleagues will type this
once to use the site. It is what stops a stranger spending your balance.

### B6. Deploy

```bash
npx wrangler deploy
```

It prints your Worker's address:

```
Published argumentor (1.23 sec)
  https://argumentor.YOUR-SUBDOMAIN.workers.dev
```

**Copy that address.** Check it is alive:

```bash
curl https://argumentor.YOUR-SUBDOMAIN.workers.dev/api/status
```

You should get JSON containing `"configured":true` and `"live":true`. If `configured` is `false`, the key
secret did not save — redo B5.

---

## Part C · Connect the site to the Worker

Right now your site still runs in offline mode. One setting changes that.

1. In your GitHub repository: **Settings → Secrets and variables → Actions**.
2. Click the **Variables** tab (**not** Secrets — this value is not secret, and the build needs to read it).
3. **New repository variable**.
   - **Name:** `ARGUMENTOR_API`
   - **Value:** your Worker address from B6, no trailing slash
4. **Add variable**.

Now rebuild the site so it picks the variable up. Any push works; the simplest:

```bash
cd '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github'
git commit --allow-empty -m "Point the site at the hosted back end"
git push
```

Or just press **Re-run all jobs** on the latest run under the **Actions** tab.

When it finishes, open your site. The badge at the top right should now read **DeepSeek · deepseek-flash**
instead of "offline template mode", and the first time you run feedback it will ask for your access code.

---

## Part D · Check it works, then watch it

1. Open your site in a **private window** (so you test it as a visitor would).
2. Load the teaching example, go to Step 3, fill in the self-assessment, tick consent, click Run.
3. It asks for the access code. Enter the one from B5.
4. You should get real four-role feedback in about seven seconds.

**For the first few days, open the DeepSeek usage page daily.** The Worker's caps are a ceiling, not a
budget, and this is your money. If anything looks wrong, you can stop all spending instantly:

```bash
cd '/Users/cts/Academic/0_Projects/2026_Persona-MAD/revised_paper_materials/argumentor-github/worker'
npx wrangler delete           # removes the Worker entirely
```

Or rotate the key without taking the site down:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

(and revoke the old one on the DeepSeek platform).

---

## If something goes wrong

| What you see | What it means |
|---|---|
| `remote: Support for password authentication was removed` | Use a Personal Access Token as the password, not your account password (A3) |
| `! [rejected] main -> main (fetch first)` | You ticked "Add a README" when creating the repo. Run `git pull --rebase origin main` then push again |
| Actions tab shows a red ✗ | Click the run to see which step failed. If it is "Fail if anything key-shaped reached the build", a key got into a file — tell me before pushing anything else |
| Site still says "offline template mode" | The `ARGUMENTOR_API` variable is missing, is under Secrets instead of Variables, or the site has not rebuilt since you added it (Part C) |
| Browser console: `CORS` or `blocked by Access-Control-Allow-Origin` | `ALLOWED_ORIGIN` in `wrangler.toml` does not exactly match your site's origin. Fix it and run `npx wrangler deploy` again |
| Feedback fails with `ACCESS_CODE_REQUIRED` | Normal on first use — enter the code. If it keeps asking, the code you typed differs from the one set in B5 |
| `"configured":false` from `/api/status` | The `DEEPSEEK_API_KEY` secret is missing. Redo B5, then `npx wrangler deploy` |
| `NO_BALANCE` | Your DeepSeek prepaid balance is empty |
| `BUDGET_LIMIT` | The daily cap in `wrangler.toml` was reached. Raise it and redeploy, or wait for the next UTC day |

---

## What ends up where, in one table

| Thing | Lives in | Public? |
|---|---|---|
| The web page | GitHub Pages | Yes — by design |
| All the source code | GitHub repository | Yes — by design |
| `wrangler.toml` (model, caps, allowed origin) | GitHub repository | Yes — contains no secret |
| **Your DeepSeek API key** | **Cloudflare secret store** | **No — never leaves Cloudflare** |
| **Your access code** | **Cloudflare secret store** | **No** |
| `ARGUMENTOR_API` (the Worker URL) | GitHub Actions *variable* | Visible in the built page — fine, it is just an address |
| Learner writing and records | The learner's own browser | No — never uploaded |
