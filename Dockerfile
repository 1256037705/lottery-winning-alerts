ARG NODE_IMAGE=public.ecr.aws/docker/library/node:24-bookworm-slim
FROM ${NODE_IMAGE} AS base
# Prisma 迁移引擎需要 OpenSSL；保留 CA 证书以校验官方数据源及 SMTP TLS。
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && apt-get clean

FROM base AS tooling
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate

FROM tooling AS builder
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
