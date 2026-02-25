# Lobbi on Oracle Cloud (Free Forever)

Oracle Cloud Free Tier gives you a **free VPS** that runs 24/7. You can connect a custom domain and HTTPS.

---

## 1. Create Oracle Cloud Account

1. Go to **cloud.oracle.com**
2. Click **Start for free**
3. Sign up (credit card required for verification, but free tier won't charge)

---

## 2. Create a VM

1. Log in → **Menu** (≡) → **Compute** → **Instances**
2. Click **Create instance**
3. Name: `lobbi`
4. **Image**: Ubuntu 22.04
5. **Shape**: Click **Change shape** → pick **Ampere** (ARM) → **VM.Standard.A1.Flex** (free)
   - Set: 1 OCPU, 6 GB memory (within free tier)
6. **Add SSH keys**: Upload your public key or generate a new pair (download the private key)
7. **Networking**: Create new VCN if needed. Under the instance, click **Edit** next to "Primary VNIC" and enable **Assign a public IPv4 address**
8. Click **Create**

Wait for the instance to be **Running**. Copy its **Public IP address**.

---

## 3. Open Port 80 and 443

1. Go to **Networking** → **Virtual cloud networks** → click your VCN
2. Click **Security Lists** → **Default Security List**
3. **Add Ingress Rule**:
   - Source: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination port: `80`
4. Add another rule for port `443`

---

## 4. SSH Into the Server

```bash
ssh -i /path/to/your-key.key ubuntu@YOUR_PUBLIC_IP
```

(Replace with your key path and IP.)

---

## 5. Run the Setup Script

Copy-paste this entire block into the SSH terminal:

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Clone Lobbi
git clone https://github.com/oubadam/lobbi.git
cd lobbi

# Install and build
npm install
npm run build

# Install PM2 (keeps app running)
sudo npm install -g pm2
```

---

## 6. Add Your .env

```bash
nano .env
```

Paste your keys (same as local):

```
ANTHROPIC_API_KEY=sk-ant-...
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api_key=YOUR_KEY
WALLET_PRIVATE_KEY=your_base58_private_key
BIRDEYE_API_KEY=...
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

---

## 7. Start Lobbi

```bash
cd ~/lobbi

# Start backend (serves website + API)
pm2 start "NODE_ENV=production DATA_DIR=./data node backend/dist/index.js" --name lobbi-backend

# Start trading bot
pm2 start "DATA_DIR=./data node clawdbot/dist/index.js" --name lobbi-bot

# Save and enable on reboot
pm2 save
pm2 startup
# Run the command it prints (starts with sudo)
```

Your site is now live at **http://YOUR_PUBLIC_IP:4000**

---

## 8. Add Nginx + Custom Domain + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo nano /etc/nginx/sites-available/lobbi
```

Paste (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lobbi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get free HTTPS
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 9. Point Your Domain

At your domain registrar (Cloudflare, Namecheap, etc.):

- **A record**: `@` → `YOUR_PUBLIC_IP`
- **A record** (or CNAME): `www` → `YOUR_PUBLIC_IP` (or `@`)

Wait a few minutes for DNS to update.

---

## Done

- Site: **https://yourdomain.com**
- Bot runs 24/7
- Free forever
- To update: `cd ~/lobbi && git pull && npm install && npm run build && pm2 restart all`
