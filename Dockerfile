FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p /app/data && chown -R node:node /app/data /app/.next
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 STATION_DB_PATH=/app/data/station.sqlite
USER node
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","--hostname","0.0.0.0"]
