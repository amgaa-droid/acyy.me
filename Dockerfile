# Production image (deploy/deploy.sh builds it on the server).
# Targets: `runner` = the Next.js standalone server; `tools` = full source + dev dependencies
# for one-off jobs (migrations, content import), run with `docker compose run --rm tools …`.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .

FROM tools AS build
# The build imports server modules that validate the environment; these placeholders exist only
# for this step and are not part of any image. The real values come from /opt/zurkhai/.env.
RUN NODE_OPTIONS=--max-old-space-size=1536 \
    DATABASE_URL=postgres://build:build@127.0.0.1:1/build \
    BETTER_AUTH_SECRET=build-only-placeholder-not-a-secret-000000 \
    QPAY_CALLBACK_SECRET=build-only-placeholder-not-a-secret-000000 \
    CRON_SECRET=build-only-placeholder \
    pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
