CREATE TABLE "tentativas_login" (
	"chave" text PRIMARY KEY NOT NULL,
	"tentativas" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tentativas_login_expira_em_index" ON "tentativas_login" USING btree ("expira_em");