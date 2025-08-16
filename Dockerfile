# ========= Frontend build (Vite) =========
FROM node:20-alpine AS fe
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build  # outputs to /app/dist

# ========= Backend runtime (serves API + static) =========
FROM node:20-alpine AS be
WORKDIR /app

# install backend deps
COPY backend/package*.json ./
RUN npm ci

# copy backend source
COPY backend/ .

# put built frontend into backend's public folder
RUN mkdir -p /app/public
COPY --from=fe /app/dist/ /app/public/
RUN mkdir -p /app/public/invoices

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]
