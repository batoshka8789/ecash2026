# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Серверные переменные: заглушки, чтобы прошла валидация окружения при
# сборке. В рантайм НЕ попадают — стадия run начинается с чистого FROM.
ARG ECASH_API_BASE_URL=https://api-dev.quiq.kz
ARG ECASH_CLIENT_ID=build
ARG ECASH_CLIENT_SECRET=build
ARG SESSION_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
ARG DATABASE_URL=postgres://build:build@localhost:5432/build
ARG APP_ORIGIN=https://ecash.kz

# NEXT_PUBLIC_* — ОБЯЗАТЕЛЬНО здесь, задать их в рантайме невозможно: Next
# подставляет их значения в клиентский бандл на этапе сборки. Без этого
# NEXT_PUBLIC_SITE_URL уходил в дефолт https://ecash.kz, и образ, собранный
# для другого домена, отдавал поисковикам чужой адрес в sitemap.xml,
# robots.txt, canonical и hreflang — молча, без единой ошибки.
#
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://ваш-домен .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DGIS_API_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DGIS_API_KEY=$NEXT_PUBLIC_DGIS_API_KEY

RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# SQL-миграции: их накатывает сам сервер при старте (src/instrumentation.ts).
# Без этой копии прод-база остаётся на той версии схемы, до которой её
# однажды довели руками, и запись в новые колонки молча падает.
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 3000
# Порт берём из $PORT, а не из константы: Railway, Cloud Run, Heroku и Fly
# подставляют свой, standalone-сервер его слушается — и проверка, прибитая
# к 3000, держала бы контейнер вечно unhealthy до перезапуска по кругу.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["node", "server.js"]
