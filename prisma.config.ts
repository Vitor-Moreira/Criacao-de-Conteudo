import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations usam a conexão direta (sem pooler) — recomendado pela Neon para DDL.
  // Em runtime, o PrismaClient usa DATABASE_URL (pooled) via driver adapter (src/lib/db.ts).
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
