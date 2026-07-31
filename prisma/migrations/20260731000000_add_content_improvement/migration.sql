-- CreateEnum
CREATE TYPE "ContentImprovementSourceType" AS ENUM ('TEXT', 'PDF', 'DOCX', 'XLSX');

-- CreateTable
CREATE TABLE "ContentImprovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" "ContentImprovementSourceType" NOT NULL,
    "originalFileUrl" TEXT,
    "originalText" TEXT,
    "analysis" TEXT,
    "improvedText" TEXT,
    "resultFileUrl" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentImprovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentImprovement_organizationId_idx" ON "ContentImprovement"("organizationId");

-- CreateIndex
CREATE INDEX "ContentImprovement_clientId_idx" ON "ContentImprovement"("clientId");

-- AddForeignKey
ALTER TABLE "ContentImprovement" ADD CONSTRAINT "ContentImprovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImprovement" ADD CONSTRAINT "ContentImprovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImprovement" ADD CONSTRAINT "ContentImprovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
