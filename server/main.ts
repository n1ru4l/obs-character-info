import http from "http";
import { Server } from "socket.io";
import { registerSocketIOGraphQLServer } from "@n1ru4l/socket-io-graphql-server";
import { InMemoryLiveQueryStore } from "@n1ru4l/in-memory-live-query-store";
import { schema } from "./schema";
import { PrismaClient } from "@prisma/client";
import type { ApplicationContext } from "./ApplicationContext";

const liveQueryStore = new InMemoryLiveQueryStore();
const prisma = new PrismaClient();

// Register Middleware for automatic model invalidation
prisma.$use(async (params, next) => {
  const resultPromise = next(params);

  if (params.action === "update" && params.model) {
    resultPromise.then((res) => {
      if (res?.id) {
        liveQueryStore.invalidate(`${params.model}:${res.id}`);
      }
    });
  }

  return resultPromise;
});

const server = http.createServer((_, res) => {
  res.writeHead(404);
  res.end();
});

const socketServer = new Server(server);

registerSocketIOGraphQLServer({
  socketServer,
  getParameter: () => ({
    execute: liveQueryStore.execute,
    graphQLExecutionParameter: {
      schema,
      contextValue: {
        liveQueryStore,
        prisma,
      } as ApplicationContext,
    },
  }),
});

process.once("SIGINT", () => {
  server.close();
});

const PORT = 4000;

server.listen(PORT, () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
});
