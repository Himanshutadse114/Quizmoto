FROM node:20-alpine

WORKDIR /app

# System packages for Phase 3 Python reports (matplotlib charts + reportlab PDF)
RUN apk add --no-cache \
        python3 \
        py3-pip \
        py3-numpy \
        py3-matplotlib \
        py3-pillow \
        freetype \
        ttf-dejavu \
        fontconfig \
        libstdc++ \
    && pip3 install --break-system-packages --no-cache-dir \
        "reportlab>=4.0.0" \
        "xlsxwriter>=3.0.0"

# Writable dirs for node user (matplotlib cache + report artifacts + charts)
RUN mkdir -p /app/data/artifacts /tmp/matplotlib /tmp/report_charts \
    && chmod -R 777 /tmp/matplotlib /tmp/report_charts /tmp

# Install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

RUN mkdir -p data/artifacts data/tmp \
    && chown -R node:node data /tmp/matplotlib /tmp/report_charts

USER node

ENV PORT=5001
# Production frontend allowlist fallback. LMSGEN is the primary customer-facing
# domain; the Render hostnames remain temporarily compatible for deployments/tests.
ENV CORS_ORIGIN=https://lmsgen.in,https://www.lmsgen.in,https://quizmoto-frontend.onrender.com,https://kahoot-awareness-frontend.onrender.com
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV PYTHONUNBUFFERED=1
ENV REPORT_PYTHON_CMD=/usr/bin/python3

EXPOSE 5001

# Render dashboard values override Docker ENV at runtime. Normalize unsafe CORS
# values before Node starts. JWT_SECRET remains the preferred explicit production
# secret. If it is absent, derive a stable non-public signing key from the already
# persistent Render Postgres credential so restarts do not rotate Live Quiz tokens.
# If neither secure source exists, fail closed instead of using a known fallback.
CMD ["sh", "-c", "if [ -z \"${JWT_SECRET:-}\" ]; then if [ -z \"${DB_PASS:-}\" ]; then echo '[productionGuards] JWT_SECRET is missing and no secure DB credential is available'; exit 1; fi; export JWT_SECRET=\"$(printf '%s' \"quizmoto-live-quiz:${DB_USER:-}:${DB_NAME:-}:${DB_PASS}\" | sha256sum | cut -d' ' -f1)\"; fi; if [ -z \"${CORS_ORIGIN:-}\" ] || [ \"${CORS_ORIGIN}\" = \"*\" ]; then export CORS_ORIGIN=\"https://lmsgen.in,https://www.lmsgen.in,https://quizmoto-frontend.onrender.com,https://kahoot-awareness-frontend.onrender.com\"; fi; exec node index.js"]
