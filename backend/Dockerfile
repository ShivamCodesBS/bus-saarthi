# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build TypeScript & Generate Prisma ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production image ──
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

# Security: run as non-root
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy runtime files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

USER nestjs

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/main.js"]
