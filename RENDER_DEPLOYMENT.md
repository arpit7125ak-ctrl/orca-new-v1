# Deploying ORCA to Render (Step-by-Step Guide)

With the included **[`render.yaml`](./render.yaml)** Blueprint file, you can deploy the complete ORCA system (Frontend, Backend, and Python AI Service) onto **[Render.com](https://render.com)** with one click.

---

## Step 1: Set Up Free MongoDB (MongoDB Atlas)

Because Render does not host MongoDB directly on the free tier, use the official free MongoDB Atlas cloud (hosted in AWS Mumbai `ap-south-1`):

1. Go to **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** and sign up (Free).
2. Click **"Create a Deployment"** $\rightarrow$ select **M0 (Free)** $\rightarrow$ Region: **AWS Mumbai (`ap-south-1`)**.
3. Under **Security Quickstart**:
   - Create a database user (e.g., username `orca_user` and a secure password).
   - Under **Where would you like to connect from?**, select **"Allow Access from Anywhere" (`0.0.0.0/0`)** so Render can connect.
4. Click **"Connect"** $\rightarrow$ **"Drivers"** $\rightarrow$ Copy the connection string:
   ```text
   mongodb+srv://orca_user:<YOUR_PASSWORD>@cluster0.xxxxx.mongodb.net/orca?retryWrites=true&w=majority
   ```
   *(Keep this string ready for Step 3).*

---

## Step 2: Push your Code to GitHub

Make sure all recent files (including `render.yaml`) are committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "Add Render Blueprint and production configurations"
git push origin main
```

---

## Step 3: Launch the Blueprint on Render (1-Click)

1. Go to your **[Render Dashboard](https://dashboard.render.com)**.
2. Click the blue **"New +"** button in the top right $\rightarrow$ select **"Blueprint"**.
3. Connect your GitHub account and select your **ORCA repository**.
4. Render will read `render.yaml` and show the 3 services it is about to create:
   - **`orca-frontend`** (Static Site — React 19 / Vite)
   - **`orca-backend`** (Web Service — Node.js Express Gateway)
   - **`orca-ai-service`** (Web Service — Python FastAPI Multi-Agent Engine)
5. Under **Environment Variables**:
   - Find **`MONGO_URI`** and paste your MongoDB Atlas connection string from Step 1.
6. Click **"Apply"**!

---

## Step 4: Verify Cross-Service Environment Linking

Render free tier web services have unique assigned subdomains. Confirm the following environment variables are set in each service's **Environment** tab:

### 1. `orca-backend`:
- **`MONGO_URI`**: Your MongoDB Atlas connection string with username and password.
- **`AI_SERVICE_URL`**: `https://orca-ai-service-b0fx.onrender.com` (or internal hostname)
- **`ALLOWED_ORIGINS`**: `*`

### 2. `orca-ai-service`:
- **`PYTHON_VERSION`**: `3.11.9` (pins pre-compiled binary wheels)
- **`BACKEND_INTERNAL_URL`**: `https://orca-backend-anp5.onrender.com`
- **`MONGO_URI`**: Same MongoDB Atlas connection string.
- **`ADAPTER_MODE`**: `real`
- **`USE_MOCK_LLM`**: `false` (or auto-fallback to true if `GEMINI_API_KEY` is not provided)

### 3. `orca-frontend`:
- **`VITE_API_BASE_URL`**: `https://orca-backend-anp5.onrender.com/api/v1`

---

## Live Production Deployment Reference

| Component | Status | Live Public URL | Health Check Endpoint |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | 🟢 Live | `https://orca-frontend-27li.onrender.com` | `https://orca-frontend-27li.onrender.com` |
| **Backend Gateway** | 🟢 Live | `https://orca-backend-anp5.onrender.com` | `https://orca-backend-anp5.onrender.com/health` (also `/api/v1/health` and `/health/ready`) |
| **AI Multi-Agent Service** | 🟢 Live | `https://orca-ai-service-b0fx.onrender.com` | `https://orca-ai-service-b0fx.onrender.com/health` |
| **MongoDB Atlas** | 🟢 Live | `Cluster0 (AWS Mumbai)` | 299 GIS boundary/port layers + 230 PFZ line advisories |

---

## Troubleshooting & Common Pitfalls

1. **`ModuleNotFoundError: No module named 'pymongo'`**:
   - Ensure `pymongo==4.5.0` and `dnspython==2.8.0` are listed in `ai-service/requirements.txt`.
2. **`error: can't find Rust compiler` for `pydantic-core`**:
   - Render defaults to Python 3.14 on Linux if unspecified. Keep `.python-version` pinned to `3.11.9` in the repository root and `rootDir: ai-service`.
3. **Frontend Displays `🔴 Offline`**:
   - Click the status badge in the top navigation bar of the web app.
   - Enter your live backend URL (`https://orca-backend-anp5.onrender.com/api/v1`) and click **Save & Connect**.
   - Or set `VITE_API_BASE_URL` in the `orca-frontend` Environment tab on Render.
4. **`ENOTFOUND orca-ai-service` in Backend `/health/ready`**:
   - Set `AI_SERVICE_URL=https://orca-ai-service-b0fx.onrender.com` in `orca-backend` Environment tab.

