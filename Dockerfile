# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Client dependencies
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Stage 2: Build client
FROM deps AS build-client

WORKDIR /app/client
COPY client/ .
RUN npm run build

# Stage 3: Build server
FROM deps AS build-server

WORKDIR /app/server
COPY server/ .
RUN npx prisma generate && npx tsc

# Stage 4: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy server production files
COPY --from=build-server /app/server/dist ./dist
COPY --from=build-server /app/server/node_modules ./node_modules
COPY --from=build-server /app/server/package.json ./package.json
COPY --from=build-server /app/server/prisma ./prisma

# Copy client build into dist/public
COPY --from=build-client /app/client/dist ./dist/public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
