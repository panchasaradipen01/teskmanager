# TaskPulse — Cloudflare Deployment Guide

This guide details how to deploy TaskPulse using **Cloudflare Pages** for the frontend and a container/VPS host behind **Cloudflare DNS & SSL** for the Express + MongoDB backend.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            CLOUDFLARE EDGE             │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │    Cloudflare Pages    │                     │   Cloudflare Proxy     │
     │   (Next.js Frontend)   │                     │      (DNS + SSL)       │
     │  taskpulse.pages.dev   │                     │  api.yourdomain.com    │
     └───────────┬────────────┘                     └────────────┬───────────┘
                 │                                               │
                 │ API Requests (NEXT_PUBLIC_API_URL)            │
                 └───────────────────────────────────────────────┘
                                                                 │
                                                                 ▼
                                                    ┌────────────────────────┐
                                                    │  Express Node.js API   │
                                                    │    (Docker / Host)     │
                                                    └────────────┬───────────┘
                                                                 │
                                                                 ▼
                                                    ┌────────────────────────┐
                                                    │    MongoDB Database    │
                                                    │ (Atlas / Self-hosted)  │
                                                    └────────────────────────┘
```

---

## Part 1: Deploy Frontend to Cloudflare Pages

### Option A: Via Cloudflare Dashboard (Recommended for Continuous Deployment)
1. Push your repository to **GitHub** or **GitLab**.
2. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Compute (Workers) > Workers & Pages > Create application > Pages > Connect to Git**.
3. Select your `teskmanager` repository.
4. Configure Build Settings:
   - **Framework preset**: `None` or `Next.js (Static Export)`
   - **Root directory**: `client`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
5. Under **Environment variables**, add:
   - `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com/api` (URL of your deployed backend)
6. Click **Save and Deploy**. Cloudflare will build and publish your site at `https://taskpulse.pages.dev` with edge SSL and global CDN.

---

### Option B: Direct CLI Deployment with Wrangler
1. Authenticate with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
2. Build and deploy the client export:
   ```bash
   npm run deploy:client
   ```
   *(Or manually)*:
   ```bash
   npm run build:client
   npx wrangler pages deploy client/out --project-name taskpulse
   ```

---

## Part 2: Deploy Backend API (Express + MongoDB)

Because Cloudflare Workers is a serverless isolate without persistent TCP Node.js sockets or local MongoDB processes, the Express server runs on a container or server host with Cloudflare providing DNS and SSL termination.

### 1. Database Setup (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Obtain your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/taskpulse?retryWrites=true&w=majority
   ```
3. Whitelist `0.0.0.0/0` (allow access from anywhere) in Atlas Network Access.

### 2. Deploy Backend Container
You can deploy using the included `server/Dockerfile` on any platform:

- **Render / Railway / Fly.io**:
  - Connect your repository.
  - Set Dockerfile path to `server/Dockerfile` (or build command `npm ci --workspace=server && npm run build:server`, start command `node server/dist/server.js`).
- **VPS / Docker Compose**:
  - Run the provided `docker-compose.yml`:
    ```bash
    docker compose up -d --build
    ```

### 3. Production Environment Variables for Backend
| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Listening port | `5001` |
| `NODE_ENV` | Environment mode | `production` |
| `MONGODB_URI` | MongoDB Atlas URI | `mongodb+srv://...` |
| `CLIENT_URL` | Cloudflare Pages domain | `https://taskpulse.pages.dev` |
| `JWT_SECRET` | 32+ char random string | (generate strong secret) |
| `ACCESS_TOKEN_SECRET` | 32+ char random string | (generate strong secret) |
| `REFRESH_TOKEN_SECRET` | 32+ char random string | (generate strong secret) |
| `COOKIE_SECURE` | Enable secure cookies | `true` |
| `COOKIE_SAME_SITE` | Cross-domain cookie support | `none` |

---

## Part 3: Option C — Cloudflare Tunnel (Self-Hosted Zero-Trust)

If you are running the backend on a server or VPS and want Cloudflare to route traffic directly without opening public ports:

1. Install `cloudflared` on your server:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```
2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create taskpulse-tunnel
   ```
3. Route DNS to your tunnel:
   ```bash
   cloudflared tunnel route dns taskpulse-tunnel api.yourdomain.com
   ```
4. Configure your ingress in `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <Tunnel-UUID>
   credentials-file: /root/.cloudflared/<Tunnel-UUID>.json

   ingress:
     - hostname: api.yourdomain.com
       service: http://localhost:5001
     - service: http_status:404
   ```
5. Run the tunnel service:
   ```bash
   cloudflared tunnel run taskpulse-tunnel
   ```

