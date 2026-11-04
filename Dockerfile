# Skyline Tycoon - single image running the API, the websocket server and
# the built client on one port.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build -w client && npm run build -w server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV CLIENT_ORIGIN=*
ENV DATA_DIR=/data
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p /data
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
