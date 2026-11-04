CREATE TABLE "carros_descartados" (
	"desejo_id" uuid NOT NULL,
	"carro_id" uuid NOT NULL,
	CONSTRAINT "carros_descartados_desejo_id_carro_id_pk" PRIMARY KEY("desejo_id","carro_id")
);
--> statement-breakpoint
ALTER TABLE "carros_descartados" ADD CONSTRAINT "carros_descartados_desejo_id_desejos_id_fk" FOREIGN KEY ("desejo_id") REFERENCES "public"."desejos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carros_descartados" ADD CONSTRAINT "carros_descartados_carro_id_carros_id_fk" FOREIGN KEY ("carro_id") REFERENCES "public"."carros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carros_descartados_carro_id_index" ON "carros_descartados" USING btree ("carro_id");