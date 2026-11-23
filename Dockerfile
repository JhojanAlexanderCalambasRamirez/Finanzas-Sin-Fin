FROM node:24-alpine AS test
WORKDIR /app
COPY package.json *.js *.css index.html ./
COPY scripts ./scripts
RUN node --test

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=test --chown=node:node /app/package.json ./
COPY --chown=node:node server.js provision.js http-handler.js database.js api-store.js ledger.js movement-tools.js validation.js recurrences.js budgets.js goals.js debts.js reports.js loans.js dashboard.js index.html styles.css backup.css app.js finance.js transaction-store.js ./
COPY --chown=node:node scripts/init-db.mjs ./scripts/init-db.mjs
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
