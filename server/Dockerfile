FROM node:20-alpine

WORKDIR /app

# Install Python and dependencies for PDF/Excel reporting
RUN apk add --no-cache python3 py3-pip py3-matplotlib py3-pillow py3-reportlab && \
    pip3 install --break-system-packages xlsxwriter

# Install dependencies (uses host network DNS during build)
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Ensure data directory exists
RUN mkdir -p data && chown node:node data

USER node

ENV PORT=5001
EXPOSE 5001

CMD ["node", "index.js"]
