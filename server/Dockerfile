FROM node:20-alpine

WORKDIR /app

# Install Python + report deps (PDF/Excel)
# py3-numpy kept for matplotlib compatibility on Alpine.
RUN apk add --no-cache \
        python3 \
        py3-pip \
        py3-numpy \
        py3-matplotlib \
        py3-pillow \
        py3-reportlab \
    && pip3 install --break-system-packages xlsxwriter

# Writable dirs for node user (matplotlib cache + report artifacts)
RUN mkdir -p /app/data/artifacts /tmp/matplotlib \
    && chmod -R 777 /tmp/matplotlib

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

RUN mkdir -p data/artifacts && chown -R node:node data

USER node

ENV PORT=5001
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV PYTHONUNBUFFERED=1

EXPOSE 5001

CMD ["node", "index.js"]
