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
# Exact production frontend allowlist fallback for Render. A valid Render dashboard
# CORS_ORIGIN overrides this value; unsafe blank/wildcard values are normalized in CMD.
ENV CORS_ORIGIN=https://kahoot-awareness-frontend.onrender.com
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV PYTHONUNBUFFERED=1
ENV REPORT_PYTHON_CMD=/usr/bin/python3

EXPOSE 5001

# Render dashboard values override Docker ENV at runtime. Some existing deployments
# still carry CORS_ORIGIN="*" (or an empty value). Convert only those unsafe values
# to the single known frontend origin before Node starts. Any explicit non-wildcard
# custom allowlist remains untouched.
CMD ["sh", "-c", "if [ -z \"$CORS_ORIGIN\" ] || [ \"$CORS_ORIGIN\" = \"*\" ]; then export CORS_ORIGIN=https://kahoot-awareness-frontend.onrender.com; fi; exec node index.js"]
