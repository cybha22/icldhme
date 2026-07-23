FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

COPY index.ts ./
COPY modules/ ./modules/
COPY utils/ ./utils/
COPY tsconfig.json ./

WORKDIR /app/data

CMD ["node", "--require", "ts-node/register", "/app/index.ts"]
