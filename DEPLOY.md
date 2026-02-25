# Deploying Lobbi to Production

**Quick path (free, 24/7, custom domain):** See **[docs/ORACLE-CLOUD-SETUP.md](docs/ORACLE-CLOUD-SETUP.md)** for step-by-step Oracle Cloud Free Tier setup.

---

## What You Need Running

1. **Backend** (Express API) — serves `/api/*` and in production also serves the built web app
2. **Clawbot** — the trading loop that discovers, buys, and sells. Must run 24/7 to trade.
3. **Web** — static React app, built and served by the backend in production

**All API keys and secrets stay on the server** — never in the frontend. Put them in `.env` on the server.

---

## Option A: Single VPS (Recommended)

Use a VPS like **DigitalOcean** ($6/mo), **Linode**, **Hetzner**, or **AWS EC2**.

### 1. Create a Droplet/Server

- Ubuntu 22.04
- 1 GB RAM minimum (2 GB better if running bot + backend)
- Add your SSH key

### 2. On the Server

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone your repo
git clone https://github.com/oubadam/lobbi.git
cd lobbi
```

### 3. Create `.env` on the Server

```bash
nano .env
```

Add (same keys as local, but on the server):

```
ANTHROPIC_API_KEY=sk-ant-...
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api_key=YOUR_KEY
WALLET_PRIVATE_KEY=your_base58_private_key
BIRDEYE_API_KEY=...
# Optional:
# LOBBI_OWN_TOKEN_MINT=...
# PORT=4000
# DATA_DIR=./data
```

**Never commit .env.** It's gitignored.

### 4. Build and Run

```bash
npm install
npm run build
```

Then run with **PM2** (keeps processes running, restarts on crash):

```bash
sudo npm install -g pm2

# Start backend (serves API + web)
cd /path/to/lobbi
pm2 start "NODE_ENV=production DATA_DIR=./data node backend/dist/index.js" --name lobbi-backend

# Start clawbot (trading loop)
DATA_DIR=./data pm2 start "node clawdbot/dist/index.js" --name lobbi-bot

pm2 save
pm2 startup   # run the command it prints to survive reboots
```

### 5. Point Your Domain

1. In your domain registrar (Cloudflare, Namecheap, etc.):
   - Add an **A record**: `@` (or `lobbi`) → your server’s public IP
   - Optionally add `www` as a CNAME to your main domain

2. Install nginx as a reverse proxy (recommended):

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/lobbi
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lobbi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

3. HTTPS with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Option B: Railway / Render / Fly.io

These can host Node apps. The **backend** can run there. The **clawbot** must run as a separate worker/process that runs 24/7.

- **Railway**: Deploy backend + clawbot as two services. Add env vars in the dashboard.
- **Render**: Web Service for backend; Background Worker for clawbot.
- **Fly.io**: Run backend and clawbot as separate machines.

Configure env vars in each platform’s dashboard. Point your domain to the backend URL.

---

## Updating After Code Changes

```bash
cd /path/to/lobbi
git pull
npm install
npm run build
pm2 restart lobbi-backend lobbi-bot
```

---

## Summary

| Component | Runs on | Port |
|-----------|---------|------|
| Backend + Web | Your server | 4000 (nginx proxies 80/443 → 4000) |
| Clawbot | Same server (separate process) | — |
| API keys, wallet | `.env` on server only | — |

**Yes, you need a server running 24/7** for Lobbi to trade. A VPS (e.g. DigitalOcean $6/mo) is the simplest setup.
