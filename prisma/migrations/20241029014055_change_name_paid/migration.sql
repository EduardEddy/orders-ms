/*
  Warnings:

  - You are about to drop the column `pais` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "pais",
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false;
