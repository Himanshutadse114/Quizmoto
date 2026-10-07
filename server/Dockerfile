FROM node:22-alpine

WORKDIR /app

# System packages for Phase 3 Python reports (matplotlib charts + reportlab PDF)
# and the LMSGEN Video Studio renderer (Pillow frames + ffmpeg assembly).
RUN apk add --no-cache \
        python3 \
        py3-pip \
        py3-numpy \
        py3-matplotlib \
        py3-pillow \
        ffmpeg \
        freetype \
        ttf-dejavu \
        font-liberation \
        fontconfig \
        libstdc++ \
        libreoffice-impress \
        poppler-utils \
    && apk add --no-cache \
        --repository=https://dl-cdn.alpinelinux.org/alpine/edge/testing \
        font-lato \
    && fc-cache -f \
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

# Render dashboard values override Docker ENV at runtime. JWT_SECRET is never
# derived here: server/config/jwtSecret.js fails fast at Node startup with a
# clear message when it is missing or weak (ephemeral random secret in test).
# Deriving the signing key from DB credentials was deliberately removed.
CMD ["node", "index.js"]
