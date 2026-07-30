-- CreateTable
CREATE TABLE "CreatorDiscovery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "theme" TEXT NOT NULL,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorDiscovery_organizationId_idx" ON "CreatorDiscovery"("organizationId");

-- CreateIndex
CREATE INDEX "CreatorDiscovery_clientId_idx" ON "CreatorDiscovery"("clientId");

-- AddForeignKey
ALTER TABLE "CreatorDiscovery" ADD CONSTRAINT "CreatorDiscovery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorDiscovery" ADD CONSTRAINT "CreatorDiscovery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
