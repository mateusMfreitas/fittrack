FROM node:24-alpine AS base
# better-sqlite3 pode precisar compilar o módulo nativo
RUN apk add --no-cache python3 make g++
WORKDIR /app

# --- Deps ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Deps de produção (sem ferramentas de build e teste) ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Build do front (Vite) ---
FROM deps AS build
COPY . .
RUN npx vite build

# --- Runtime: Express serve o build e a API ---
FROM node:24-alpine AS runtime
# libstdc++: exigida pelo módulo nativo do better-sqlite3
RUN apk add --no-cache libstdc++
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV PORT=3000
ENV DATABASE_PATH=/app/data/fittrack.db
ENV BACKUP_PATH=/app/backups

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data /app/backups
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node_modules/.bin/tsx", "server/index.ts"]
