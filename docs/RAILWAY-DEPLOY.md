# Deploy Lobbi on Railway

Railway runs your backend, clawbot, and serves the website. One service, always on.

---

## 1. Push to GitHub

Make sure your code is on GitHub: `github.com/oubadam/lobbi`

---

## 2. Create Railway Project

1. Go to **railway.app** and sign in (GitHub)
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select **oubadam/lobbi**
5. Railway will detect the repo and start a deploy

---

## 3. Configure the Service

In your project, click the service, then **Settings**:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:railway`
- **Root Directory:** leave blank (uses repo root)

---

## 4. Add Environment Variables

In the service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `./data` |
| `ANTHROPIC_API_KEY` | your key |
| `SOLANA_RPC_URL` | your Helius/RPC URL |
| `WALLET_PRIVATE_KEY` | your wallet (base58) |
| `BIRDEYE_API_KEY` | your key |

(Optional: `LOBBI_OWN_TOKEN_MINT` if you use it)

---

## 5. Add a Volume (Optional but Recommended)

Without a volume, `trades.json` and `state.json` are lost on redeploy. To persist:

1. Click **+ New** → **Volume**
2. Name it `lobbi-data`
3. Mount path: `/data`
4. Attach the volume to your service
5. Change `DATA_DIR` to `/data`

---

## 6. Generate Domain

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. You get a URL like `lobbi-production.up.railway.app`

---

## 7. Custom Domain (Optional)

1. **Settings** → **Networking** → **Custom Domain**
2. Add your domain (e.g. `lobbi.yourdomain.com`)
3. Add the CNAME record at your registrar:
   - **Name:** `lobbi` (or `@` for root)
   - **Value:** `your-app.up.railway.app`
   - **Type:** CNAME

---

## 8. Deploy

Railway deploys on every push to `main`. After the first deploy finishes, your site is live at the generated URL.

---

## Cost

- **$5 free credit** per month (from new accounts)
- After that, roughly **$5–10/month** for always-on usage
- Check usage in **Account** → **Usage**

---

## Updating

Push to GitHub → Railway redeploys automatically.
