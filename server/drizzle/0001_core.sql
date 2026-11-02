CREATE TABLE "carros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"marca" text NOT NULL,
	"modelo" text NOT NULL,
	"versao" text,
	"ano_fabricacao" smallint,
	"ano_modelo" smallint,
	"km" integer,
	"cambio" text,
	"combustivel" text,
	"carroceria" text,
	"cor" text,
	"motor" text,
	"portas" smallint,
	"opcionais" text[] DEFAULT '{}' NOT NULL,
	"descricao" text,
	"preco_venda" integer,
	"destaque" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"preco_compra" integer,
	"custo_preparacao" integer,
	"custo_documentacao" integer,
	"custo_comissao" integer,
	"preco_minimo" integer,
	"data_entrada" date NOT NULL,
	"placa" text,
	"chassi" text,
	"renavam" text,
	"origem" text,
	"observacoes_internas" text,
	"vendido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carros_slug_unique" UNIQUE("slug"),
	CONSTRAINT "carros_placa_unique" UNIQUE("placa"),
	CONSTRAINT "carros_chassi_unique" UNIQUE("chassi"),
	CONSTRAINT "carros_renavam_unique" UNIQUE("renavam")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"origem" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE TABLE "fotos_carro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carro_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"tipo_mime" text NOT NULL,
	"dados" "bytea" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"carro_id" uuid NOT NULL,
	"etapa" text DEFAULT 'novo' NOT NULL,
	"motivo_perda" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interesses_cliente_id_carro_id_unique" UNIQUE("cliente_id","carro_id")
);
--> statement-breakpoint
CREATE TABLE "loja" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"nome" text NOT NULL,
	"cidade" text,
	"slogan" text,
	"whatsapp" text,
	"instagram" text,
	"mostrar_preco" boolean DEFAULT true NOT NULL,
	"mostrar_vendidos" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loja_unica" CHECK ("loja"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	CONSTRAINT "sessoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "fotos_carro" ADD CONSTRAINT "fotos_carro_carro_id_carros_id_fk" FOREIGN KEY ("carro_id") REFERENCES "public"."carros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interesses" ADD CONSTRAINT "interesses_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interesses" ADD CONSTRAINT "interesses_carro_id_carros_id_fk" FOREIGN KEY ("carro_id") REFERENCES "public"."carros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fotos_carro_carro_id_ordem_index" ON "fotos_carro" USING btree ("carro_id","ordem");--> statement-breakpoint
CREATE INDEX "interesses_carro_id_index" ON "interesses" USING btree ("carro_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_id_index" ON "sessoes" USING btree ("usuario_id");