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

## What Happens Automatically:

- Render automatically generates secure, matching random keys for `INTERNAL_SECRET` and `JWT_SECRET`.
- Render automatically connects the Frontend to the Backend's live URL.
- Render automatically connects the AI Service to the Backend's callback endpoint.
- Free SSL certificates (HTTPS) are provisioned for all services.

When the build completes (approx. 3–4 minutes), your dashboard will show green checkmarks and your live frontend link:
👉 **`https://orca-frontend.onrender.com`**
