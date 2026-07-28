---
description: how to deploy updates to the VPS
---

1. Ensure all local changes are saved.
2. Package the source code:
// turbo
`tar -czf kahoot-deploy.tar.gz --exclude="node_modules" --exclude=".git" --exclude="dist" client server docker-compose.yml`
3. Upload `kahoot-deploy.tar.gz` to the server root at `/home/platform/public_html/Kahoot-Awareness`.
4. Run extraction on VPS:
`tar -xzf kahoot-deploy.tar.gz`
5. Rebuild and restart services on VPS:
`docker-compose up --build -d`
