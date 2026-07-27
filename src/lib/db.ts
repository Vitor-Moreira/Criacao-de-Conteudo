import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton do PrismaClient.
// Em produção (Neon), usamos o driver adapter da Neon (conexão via HTTP/WebSocket,
// adequada a ambientes serverless/edge da Vercel — evita esgotar o pool de conexões do Postgres).
// Para qualquer outro Postgres (ex: banco de dev provisionado via `npx create-db`),
// caímos para o adapter padrão node-postgres.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const isNeon = connectionString?.includes("neon.tech");

  const adapter = isNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
