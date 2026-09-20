# ORCA Maritime & Coastal Advisory Platform — Production Deployment Guide (`DEPLOYMENT.md`)

> **Platform Version**: 1.0.0 Production Release  
> **Supported Environments**: Ubuntu 22.04/24.04 LTS, Debian 12, AWS EC2, DigitalOcean, GCP, Hetzner, Docker Compose, Render / Vercel PaaS.

---

## 1. Architecture Overview

ORCA operates as a unified, high-availability maritime risk platform:

| Component | Technology | Internal Port | Public Exposure | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React 19 + Vite + Nginx | `80` | `80` / `443` (HTTPS) | Web dashboard, Leaflet GIS, Chatbot |
| **Public Gateway** | Node.js (Express) | `4000` | Via Nginx `/api/v1` | Public API & validation gateway |
| **Internal Gateway** | Node.js (Express) | `4100` | **Private Only** | Protected AI callback listener |
| **AI Service** | Python 3.11 + FastAPI | `8000` | **Private Only** | Multi-agent planner & telemetry |
| **Database** | MongoDB 7.0 | `27017` | **Private Only** | Persistent analysis & alert storage |

---

## 2. Deployment Path A: Dedicated VPS / Cloud VM (Recommended)

*Recommended server spec: 2 vCPU, 4GB RAM (e.g. AWS `t3.medium`, DigitalOcean $18/mo, or Hetzner CX22).*

### Step 1: Install Docker & Docker Compose
On a fresh Ubuntu 22.04 / 24.04 server:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version && docker compose version
```

---

### Step 2: Clone Repository & Configure Environment

```bash
# 1. Clone the project repository
git clone https://github.com/your-org/orca.git
cd orca

# 2. Generate secrets and create .env file
cp .env.example .env

# Generate secure 64-char secrets:
INTERNAL_KEY=$(openssl rand -hex 32)
JWT_KEY=$(openssl rand -hex 32)

# Update .env with your generated keys:
sed -i "s/INTERNAL_SECRET=.*/INTERNAL_SECRET=$INTERNAL_KEY/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_KEY/" .env
```

---

### Step 3: Configure Your Domain & DNS

1. Go to your DNS provider (Cloudflare, GoDaddy, Route53, Namecheap).
2. Add an **A record**:
   - **Name**: `orca` (or `@` for root domain)
   - **Target / IP**: `YOUR_SERVER_PUBLIC_IP`
   - **TTL**: Auto / 5 minutes
3. Wait 1–2 minutes for DNS propagation. Verify via:
   ```bash
   ping orca.yourdomain.com
   ```

---

### Step 4: One-Click SSL & Launch Stack

Run the built-in SSL provisioning script:

```bash
# Make script executable
chmod +x deploy/init-ssl.sh

# Run initializer with your domain and email:
sudo ./deploy/init-ssl.sh orca.yourdomain.com your-email@example.com
```

The script will automatically:
1. Configure Nginx virtual hosts for your domain.
2. Launch the backend, AI service, and MongoDB containers.
3. Request official Let's Encrypt TLS certificates.
4. Reload Nginx with full HTTPS (TLS 1.3) and HTTP $\rightarrow$ HTTPS automatic redirect.

---

### Step 5: Verify Live Health & Contracts

```bash
# Check running containers
docker compose ps

# Check API health
curl -f https://orca.yourdomain.com/health

# Run contract validation inside backend container
docker compose exec backend python3 scripts/check-contracts.py
```
Expected output: **`15/15 payload shapes conform.`**

---

## 3. Deployment Path B: Managed Cloud PaaS (Zero Server Maintenance)

If deploying across managed cloud services (Render, Vercel, MongoDB Atlas):

### 1. Database: MongoDB Atlas
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) in AWS Mumbai (`ap-south-1`).
2. Under **Network Access**, allow your IP or `0.0.0.0/0`.
3. Under **Database Access**, create a user `orca_app`.
4. Copy the connection string (e.g. `mongodb+srv://orca_app:<password>@cluster0.mongodb.net/orca?retryWrites=true&w=majority`).

---

### 2. Backend & Internal Gateway (Render / Railway)
- **Repo root:** `orca/backend`
- **Build Command:** `npm ci --omit=dev`
- **Start Command:** `node src/start-both.js`
- **Environment Variables:**
  - `NODE_ENV`: `production`
  - `PORT`: `4000`
  - `INTERNAL_PORT`: `4100`
  - `INTERNAL_SECRET`: `<64-char hex string>`
  - `JWT_SECRET`: `<64-char hex string>`
  - `MONGO_URI`: `<Atlas connection string>`
  - `AI_SERVICE_URL`: `<URL of AI Service>`
  - `ALLOWED_ORIGINS`: `https://your-frontend.vercel.app`

---

### 3. AI Service (Render / Railway / Cloud Run)
- **Repo root:** `orca/ai-service`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Environment Variables:**
  - `ENV`: `production`
  - `AI_SERVICE_PORT`: `8000`
  - `BACKEND_INTERNAL_URL`: `https://your-backend.onrender.com:4100`
  - `INTERNAL_SECRET`: `<Identical 64-char hex string>`
  - `MONGO_URI`: `<Atlas connection string>`
  - `ADAPTER_MODE`: `live`

---

### 4. Frontend (Vercel / Cloudflare Pages)
- **Framework Preset:** Vite
- **Root Directory:** `orca/frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:**
  - `VITE_API_BASE_URL`: `https://your-backend.onrender.com/api/v1`

---

## 4. Production Operations & Maintenance

### Viewing Live Container Logs
```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f backend
docker compose logs -f ai-service
```

### Performing Zero-Downtime Application Updates
```bash
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Database Backup (MongoDB Automated Dump)
Add a daily cron job to back up the database:
```bash
# Create backup directory
mkdir -p /backups/mongo

# Add crontab entry (Runs at 02:00 AM daily)
(crontab -l 2>/dev/null; echo "0 2 * * * docker exec orca-mongo mongodump --db orca --archive > /backups/mongo/orca_\$(date +\%F).dump") | crontab -
```

---

## 5. Summary Checklist Before Public Launch

- [x] All 15 JSON Schema contracts verified (`check-contracts.py` $\rightarrow$ 15/15 Pass).
- [x] `INTERNAL_SECRET` is byte-identical between Backend and AI Service.
- [x] Internal port `4100` is isolated inside private network.
- [x] CORS `ALLOWED_ORIGINS` configured to live production domain.
- [x] Nginx reverse proxy configured with TLS 1.3 and automatic HTTP-to-HTTPS redirect.
- [x] Ask ORCA Copilot tested and working with live marine telemetry.
