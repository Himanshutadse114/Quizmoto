# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --base=/

# Production stage
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Serve the public marketing pages as real HTML documents at their canonical
# URLs. The authenticated LMS stays a React SPA under /login, /scorm, etc.
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json application/xml image/svg+xml;\n\
    \n\
    if ($host = lmsgen.in) { return 301 https://www.lmsgen.in$request_uri; }\n\
    \n\
    location = / { try_files /landing/index.html =404; }\n\
    location = /solutions { try_files /landing/solutions/index.html =404; }\n\
    location = /solutions/ { return 301 /solutions; }\n\
    location = /about { try_files /landing/about/index.html =404; }\n\
    location = /about/ { return 301 /about; }\n\
    location = /blog { try_files /landing/blog/index.html =404; }\n\
    location = /blog/ { return 301 /blog; }\n\
    location ~ ^/blog/([a-z0-9-]+)/$ { return 301 /blog/$1; }\n\
    location ~ ^/blog/([a-z0-9-]+)$ { try_files /landing/blog/$1.html =404; }\n\
    location = /contact { try_files /landing/contact/index.html =404; }\n\
    location = /contact/ { return 301 /contact; }\n\
    \n\
    location = /landing/index.html { return 301 /; }\n\
    location = /landing/solutions/index.html { return 301 /solutions; }\n\
    location = /landing/about/index.html { return 301 /about; }\n\
    location = /landing/blog/index.html { return 301 /blog; }\n\
    location = /landing/contact/index.html { return 301 /contact; }\n\
    \n\
    location ~* \\.(?:css|js|mjs|svg|png|jpg|jpeg|webp|avif|woff|woff2)$ {\n\
        expires 30d;\n\
        add_header Cache-Control "public, max-age=2592000, immutable";\n\
        try_files $uri =404;\n\
    }\n\
    \n\
    location /api/ {\n\
        proxy_pass http://backend:5001/api/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
    \n\
    location /socket.io/ {\n\
        proxy_pass http://backend:5001/socket.io/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
    \n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
