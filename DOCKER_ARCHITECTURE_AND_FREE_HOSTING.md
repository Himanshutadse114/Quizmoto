his file t

# Docker Architecture, Interactivity Audit & Free Hosting Guide

This document outlines the full-stack architecture, internal container networking, and manual verification results for the real-time quiz application. Additionally, it details instructions for deploying and hosting the game totally **for free** (either locally via Cloudflare Tunnels or continuously on free cloud platforms), removing the requirement for a paid VPS server.

---

## 1. Complete Stack Architecture & Connectivity Audit

A manual code audit verifies that the **Frontend**, **Backend**, and **MariaDB Database** containers communicate seamlessly within Docker's internal networking bridges.

### A. Frontend ↔ Backend Bridge (Reverse Proxy Configuration)

- **Relative Request Routing**: In the React frontend (e.g., [`SocketContext.jsx`](file:///c:/kahoot-awareness/client/src/context/SocketContext.jsx) and [`AuthContext.jsx`](file:///c:/kahoot-awareness/client/src/context/AuthContext.jsx)), all HTTP API endpoints (`/api/...`) and real-time Socket.io WebSockets connect dynamically to `window.location.origin` using relative paths rather than static hardcoded URLs.
- **In-Cluster NGINX Gateway**: In [`client/Dockerfile`](file:///c:/kahoot-awareness/client/Dockerfile), the Vite client is packaged into an optimized `nginx:stable-alpine` server listening on port `80`. NGINX handles traffic routing using an internal reverse proxy:
  ```nginx
  location /api/ {
      proxy_pass http://backend:5001/api/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
  }

  location /socket.io/ {
      proxy_pass http://backend:5001/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
  }
  ```
- **Result**: Because Nginx transparently routes `/api/` and `/socket.io/` requests across Docker's internal network to the service named **`backend`** on port **`5001`**, Cross-Origin Resource Sharing (CORS) bugs and WebSocket connection failures are completely eliminated.

### B. Backend Server Docker Configuration

- **Container Specification**: Verified in [`server/Dockerfile`](file:///c:/kahoot-awareness/server/Dockerfile). Uses lightweight `node:20-alpine`, installs production dependencies cleanly, and ensures the persistent storage folder `/app/data` is provisioned with proper `node` group permissions.
- **Service Dependency & Volume Mapping**: In [`docker-compose.yml`](file:///c:/kahoot-awareness/docker-compose.yml), the backend binds to port `5001:5001` and mirrors local directory `./server/data:/app/data` to ensure uploaded data is preserved across container redeployments.
- **Strict Readiness Ordering**:
  ```yaml
  depends_on:
    db:
      condition: service_healthy
  ```

  The server explicitly pauses booting until the database service passes its health diagnostics, preventing startup crashed caused by race conditions.

### C. Backend ↔ Database Integration

- **Database Engine & Health Diagnostics**: Running `mariadb:10.11` as the container service named **`db`**, configured with native healthcheck probing (`healthcheck.sh --connect --innodb_initialized`).
- **Network Resolution**: While standalone desktop testing falls back to `127.0.0.1` defined inside `server/.env`, Docker Compose explicitly loads the root-level [`./.env`](file:///c:/kahoot-awareness/.env) file where **`DB_HOST=db`** is set.
- **Sequelize Initialization**: In [`server/config/database.js`](file:///c:/kahoot-awareness/server/config/database.js), Sequelize consumes these injected environment variables:
  ```javascript
  sequelize = new Sequelize(
      process.env.DB_NAME || 'kahoot_awareness',
      process.env.DB_USER || 'root',
      process.env.DB_PASS || '',
      {
          host: process.env.DB_HOST || 'localhost', // Automatically resolves to container service 'db' in Docker
          dialect: 'mysql',
          port: process.env.DB_PORT || 3306
      }
  );
  ```

  Sequelize automatically resolves `db` via Docker DNS, establishes database tables, synchronizes associations (Quizzes, Questions, GameSessions, Players, and Answers), and applies schema column additions smoothly.

---

## 2. Free Hosting & Deployment Guide (No VPS Required)

If you do not have access to a paid server or VPS, you can run and expose this real-time game completely free of charge using one of the following procedures:

### Option A: Local Run + Cloudflare Tunnel (Recommended for Live Games & Classrooms)

When hosting real-time awareness quizzes (like Kahoot), the platform typically only needs to be live while you are actively conducting a quiz session. You can run the application locally on your computer and open a secure public link for free without configuring firewalls or routers.

#### Step 1: Start Your App Locally in Docker

Open terminal in your workspace root directory and boot up the stack:

```powershell
# To start the dedicated local development compose stack:
docker-compose -f docker-compose.local.yml up -d

# OR to test using the standard production compose configuration:
docker-compose up -d
```

*(Note: In `docker-compose.local.yml`, your frontend listens on port `9083`. In the primary `docker-compose.yml`, it listens on port `8083`.)*

#### Step 2: Establish a Free Public Cloudflare Tunnel

With Node installed on your computer, open a terminal window and execute the official free Cloudflare tunnel command—no user registration or account required:

```powershell
# For docker-compose.local.yml (Port 9083):
npx cloudflared tunnel --url http://localhost:9083

# For docker-compose.yml (Port 8083):
npx cloudflared tunnel --url http://localhost:8083
```

#### Step 3: Share the Public Link

- Within seconds, Cloudflare will display a globally accessible HTTPS link in your terminal console (for example: `https://swift-quiz-arena.trycloudflare.com`).
- **Why this works seamlessly**: Since Nginx inside the Docker container serves the frontend and automatically proxies `/api/` and `/socket.io/` traffic to the backend, sharing just this single Cloudflare tunnel URL grants users from anywhere in the world full access to register, create rooms, and participate in real-time quiz games on their phones or laptops!
- Once your game or live classroom event finishes, simply terminate the cloudflared command and execute `docker-compose down`.

---

### Option B: 24/7 Perpetual Cloud Setup (Free Cloud Tiers)

If you want the application publicly accessible online 24/7 without keeping your computer switched on, you can decouple the Docker stack and publish individual components to generous free-tier cloud platforms:

1. **MySQL / MariaDB Database (Replaces `db` Container)**

   - **Provider**: [Aiven.io](https://aiven.io) or [TiDB Cloud](https://tidbcloud.com) (Both provide fully managed serverless MySQL free tiers).
   - **Management**: Skip installing phpMyAdmin container and administer your cloud tables directly from your PC using free tools like [DBeaver](https://dbeaver.io) or [HeidiSQL](https://www.heidisql.com).
2. **Backend Server & WebSockets (Replaces `backend` Container)**

   - **Provider**: [Render.com](https://render.com) (Free Web Service tier), [Koyeb](https://www.koyeb.com), or [Fly.io](https://fly.io).
   - **Setup**: Link your GitHub repository directly to Render, selecting the `/server` folder as the root directory.
   - **Configuration**: Inside Render's dashboard, provide your newly created Cloud Database connection credentials (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`).
3. **Frontend SPA Hosting (Replaces `frontend` NGINX Container)**

   - **Provider**: [Vercel](https://vercel.com), [Cloudflare Pages](https://pages.cloudflare.com), or [Netlify](https://netlify.com) (Offering fast, global static content distribution with free custom domains and HTTPS SSL).
   - **Setup**: Connect your `/client` directory. Configure your frontend API environment variable to point directly to your live deployed Render backend URL.
