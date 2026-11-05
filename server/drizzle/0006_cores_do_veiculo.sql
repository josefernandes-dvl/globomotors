ALTER TABLE "carros" ADD COLUMN "cores" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE "carros" SET "cores" = ARRAY[btrim("cor")] WHERE btrim(coalesce("cor", '')) <> '';
