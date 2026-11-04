CREATE TABLE "desejos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ano_minimo" smallint,
	"preco_maximo" integer,
	"observacoes" text,
	"ordem" integer GENERATED ALWAYS AS IDENTITY (sequence name "desejos_ordem_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carros" ADD COLUMN "publicado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "desejos" ADD CONSTRAINT "desejos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "desejos_cliente_id_nome_unique" ON "desejos" USING btree ("cliente_id",lower("nome"));