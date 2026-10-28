# Put Inner Space online (Render) — step by step

When you finish, Inner Space has its own web address (like `https://inner-space-xxxx.onrender.com`).
Anyone who opens it gets Claude (Talk, Mirror, Origin…) and the ElevenLabs voice (Brian in English,
your Arabic voice in Arabic). Your keys live only inside Render; nobody can see them.

**Cost:** Render $7/month + $0.25/month for the 1 GB disk. Plus what you use on Claude and ElevenLabs.

---

## What is in this folder

| File | What it is |
|---|---|
| `inner-space.html` | The app (V100) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lets people add it to their home screen like a real app |
| `server/` | The server: Claude, the voice, and the limits that protect your bills |
| `render.yaml` | Tells Render how to run everything |
| `.gitignore` | Makes sure a key file can never be uploaded |

Optional: if your Inner Space folder on your PC has an `assets` folder (pictures, videos), copy it
into this folder too, next to `inner-space.html`.

---

## Step 1 · GitHub: a private home for the files (10 min)

Render takes the app from GitHub.

1. Go to **github.com** and sign up (free).
2. Top right **+** → **New repository**.
   - Name: `inner-space`
   - Choose **Private**
   - Click **Create repository**
3. On the next page, click **uploading an existing file**.
4. Unzip `inner-space-deploy.zip` on your PC. Open the `inner-space` folder.
   Select **everything inside it** (not the folder itself) and drag it onto the GitHub page.
   You should see `inner-space.html`, `sw.js`, `manifest.webmanifest`, `render.yaml`, `package.json`,
   `.gitignore`, `DEPLOY-GUIDE.md`, `icons`, `server`.
5. Click **Commit changes**. Wait until the upload finishes. `inner-space.html` is large (22 MB), so this can take a minute.

**Never put a key in any file you upload.**

---

## Step 2 · Render: run it (10 min)

1. Go to **render.com** → **Get Started** → sign up **with GitHub**.
2. Click **New +** → **Blueprint**.
3. Choose your `inner-space` repository → **Connect**.
4. Render reads `render.yaml` and asks for three secret values. Paste them here, and only here:
   - `ANTHROPIC_API_KEY` → your Claude key (from platform.claude.com)
   - `ELEVENLABS_API_KEY` → your ElevenLabs key
   - `ELEVENLABS_VOICE_AR` → the **Voice ID** of your Arabic voice (ElevenLabs → My Voices → your voice → copy ID).
     If you don't have one yet, leave it empty: Brian will read the Arabic too.
5. Click **Apply**. Render asks for a card for the $7 plan.
6. Wait 2–4 minutes. Open the **Logs** tab. You should see:
   ```
   Model: claude-sonnet-5-5
   Voice: ElevenLabs · Brian · Arabic: <your voice id>
   Page ready: 22.1 MB → br 11.2 MB
   ```
7. At the top of the page is your address: `https://inner-space-xxxx.onrender.com`.

---

## Step 3 · Try it on your phone (5 min)

1. Open the address in Chrome or Samsung Internet.
2. Menu → **Add to Home screen**. Now it opens like an app.
3. Play a story in **English**: the voice should be Brian. Lock the phone; it keeps talking.
4. Switch to **Arabic** (the ع button) and play a story: your Arabic voice.
5. Open **Talk** and write something: a real answer means Claude is working.

The first time anyone hears a line, it takes a second to make. After that it's saved forever and plays instantly
for everyone, for free. So play every story once yourself, in both languages, and they will be instant
for all your users.

---

## Updating the app later

When I send you a new `inner-space.html` and `sw.js`:
1. GitHub → your repository → **Add file** → **Upload files** → drop the two files → **Commit changes**.
2. Render sees it and updates by itself in about 2 minutes. Nothing else to do.

---

## What protects your money (already set up)

All of these can be changed in Render → your service → **Environment**:

| Setting | Default | Meaning |
|---|---|---|
| `LIMIT_AI_PER_HOUR` | 30 | Claude messages per person per hour |
| `LIMIT_AI_PER_DAY` | 120 | Claude messages per person per day |
| `LIMIT_AI_SERVER_PER_DAY` | 3000 | Claude messages for everyone together per day |
| `LIMIT_VOICE_CHARS_PER_DAY` | 15000 | New voice characters per person per day (about 10 stories). Saved lines never count. |
| `LIMIT_VOICE_SERVER_CHARS_PER_DAY` | 200000 | New voice characters for everyone together per day |

When a limit is reached, the app quietly falls back: Talk uses its own built-in answers, and the
voice uses the phone's own voice. Nothing breaks.

Also set a spend limit in **platform.claude.com → Billing**, and a credit limit on your ElevenLabs key.

## If something goes wrong

- **Page doesn't load:** check Render → Logs for a red error and send it to me.
- **Voice is the phone's voice, not Brian:** the ElevenLabs key is wrong or out of credits. Check Logs for `[voice] FAILED`.
- **Talk gives short built-in answers:** the Claude key is wrong or out of credit. Check Logs for `[anthropic]`.
- **A key leaked:** delete it on the provider's site, make a new one, and paste it into Render → Environment.
