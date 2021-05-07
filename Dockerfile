FROM node:16-alpine as base

WORKDIR /usr/context

RUN apk add --update --no-cache python3 alpine-sdk && ln -sf python3 /usr/bin/python

FROM base as builder-base

COPY package.json yarn.lock ./
COPY patches/ ./patches/
RUN yarn

FROM builder-base as frontend-builder

COPY vite.config.ts ./
COPY src ./src/
COPY public ./public/
COPY index.html ./
RUN yarn build

FROM builder-base as backend-builder

COPY server ./server/
RUN yarn server:build

FROM base as dependency-builder

ARG NODE_ENV="production"
ENV NODE_ENV="production"

COPY package.json yarn.lock ./
COPY patches/ ./patches/
RUN yarn

FROM node:16-alpine

WORKDIR /usr/app

ARG NODE_ENV="production"
ENV NODE_ENV="production"

COPY package.json yarn.lock ./
RUN mkdir -p /data/uploads
COPY --from=dependency-builder /usr/context/node_modules/ ./node_modules/
COPY --from=backend-builder /usr/context/server-build/ ./server-build
COPY --from=frontend-builder /usr/context/dist ./dist/

ENV DATABASE_URL="/data/database.db"
ENV STORAGE_DIRECTORY="/data"

ARG APP_VERSION="latest"
ENV APP_VERSION=$APP_VERSION

CMD [ "node", "server-build/main.js" ]
