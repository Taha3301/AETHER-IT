-- Add nullable manager relations without changing existing content records.
ALTER TABLE "Employee" ADD COLUMN "managerId" UUID;
ALTER TABLE "Service" ADD COLUMN "managerId" UUID;
ALTER TABLE "WebsiteContent" ADD COLUMN "managerId" UUID;

CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");
CREATE INDEX "Service_managerId_idx" ON "Service"("managerId");
CREATE INDEX "WebsiteContent_managerId_idx" ON "WebsiteContent"("managerId");

ALTER TABLE "Employee"
ADD CONSTRAINT "Employee_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteContent"
ADD CONSTRAINT "WebsiteContent_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
