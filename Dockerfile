# Stage 1: Install dependencies and build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Disable Next.js telemetry during builds
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Runner container using Alpine Node.js
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy build standalone files and public static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
