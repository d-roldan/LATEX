FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM deps AS builder
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
RUN npm prune --omit=dev
EXPOSE 3000
USER node
CMD ["node", "dist/src/main.js"]







