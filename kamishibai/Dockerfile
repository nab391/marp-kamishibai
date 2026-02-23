########################
# deps stage
########################
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm i --omit=dev

########################
# runtime stage
########################
FROM node:24-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache ffmpeg && \
    addgroup -S app && adduser -S app -G app && \
    mkdir -p /app/narration /app/voices /app/sound && \
    chown -R app:app /app

ENV NODE_ENV=production \
    VOICEVOX_URL=http://host.docker.internal:50021 \
    FFMPEG=ffmpeg

# 依存とアプリ本体だけコピー
COPY --from=deps /app/node_modules ./node_modules
COPY server.mjs ./server.mjs

USER app
EXPOSE 8081
CMD ["node", "server.mjs"]

