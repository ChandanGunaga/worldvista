FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && mkdir -p /app/uploads && chown -R node:node /app/uploads
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
USER node
# Applies pending migrations, then starts the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
