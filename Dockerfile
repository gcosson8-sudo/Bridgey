FROM mcr.microsoft.com/playwright:v1.59.1-noble AS builder

WORKDIR /app

COPY package.json tsconfig.base.json tsconfig.json vitest.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/browser-worker/package.json packages/browser-worker/package.json
COPY packages/luau-sdk/package.json packages/luau-sdk/package.json

RUN npm install

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=pwuser:pwuser /app/package.json ./package.json
COPY --from=builder --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=builder --chown=pwuser:pwuser /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=pwuser:pwuser /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=pwuser:pwuser /app/apps/api/public ./apps/api/public
COPY --from=builder --chown=pwuser:pwuser /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder --chown=pwuser:pwuser /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder --chown=pwuser:pwuser /app/packages/browser-worker/package.json ./packages/browser-worker/package.json
COPY --from=builder --chown=pwuser:pwuser /app/packages/browser-worker/dist ./packages/browser-worker/dist

USER pwuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
