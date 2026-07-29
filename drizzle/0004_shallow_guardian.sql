CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news" ALTER COLUMN "key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "author_account_id" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Перенос двух существующих новостей: раньше тексты жили в messages/*.json
-- и были вшиты в бандл, теперь контент целиком в БД.
UPDATE "news" SET "translations" = $mig${"ru": {"title": "Путешественники", "excerpt": "", "body": "В подготовке к поездке важно всё продумать заранее, включая обмен валюты. Наши услуги помогут вам быстро и без лишних сложностей получить нужную сумму, чтобы вы могли сосредоточиться на отдыхе или работе, а не искать обменники по приезду. Мы предлагаем выгодные условия, а также профессиональные консультации для тех, кто хочет быть уверен в каждом этапе своего путешествия."}, "en": {"title": "Travelers", "excerpt": "", "body": "When preparing for a trip, it is important to think everything through in advance, including currency exchange. Our services help you get the amount you need quickly and hassle-free, so you can focus on your vacation or work instead of looking for exchange offices upon arrival. We offer favorable terms and professional advice for those who want to be confident at every stage of their journey."}, "kk": {"title": "Саяхатшылар", "excerpt": "", "body": "Сапарға дайындықта бәрін алдын ала ойластыру маңызды, соның ішінде валюта айырбастауды да. Біздің қызметтер қажетті соманы жылдам әрі қиындықсыз алуға көмектеседі, осылайша сіз келген соң айырбастау орнын іздемей, демалысқа немесе жұмысқа назар аудара аласыз. Біз тиімді шарттар мен саяхаттың әр кезеңіне сенімді болғысы келетіндерге кәсіби кеңес ұсынамыз."}, "zh": {"title": "旅行者", "excerpt": "", "body": "出行前的准备需要面面俱到，货币兑换也不例外。我们的服务让您快速、省心地换到所需金额，无需抵达后四处寻找兑换点，从而专心享受旅程或处理工作。我们提供优惠的条件和专业的建议，让您在旅途的每一个环节都安心从容。"}}$mig$::jsonb, "status" = 'published' WHERE "slug" = 'travelers';
--> statement-breakpoint
UPDATE "news" SET "translations" = $mig${"ru": {"title": "Жители городов", "excerpt": "", "body": "Обмен валюты нужен каждому — будьте то для сбережений, выгодных вложений или крупных покупок. Мы помогаем вам легко и быстро обменять деньги, гарантируя выгодные условия и пользу на каждом этапе."}, "en": {"title": "City dwellers", "excerpt": "", "body": "Everyone needs currency exchange — whether for savings, profitable investments or large purchases. We help you exchange money easily and quickly, guaranteeing favorable terms and value at every step."}, "kk": {"title": "Қала тұрғындары", "excerpt": "", "body": "Валюта айырбастау әркімге қажет — жинақ үшін де, тиімді салымдар немесе ірі сатып алулар үшін де. Біз әр кезеңде тиімді шарттар мен пайданы кепілдендіре отырып, ақшаны оңай әрі жылдам айырбастауға көмектесеміз."}, "zh": {"title": "城市居民", "excerpt": "", "body": "无论是储蓄、稳健投资还是大额消费，每个人都会用到货币兑换。我们让您轻松快捷地完成兑换，并在每一个环节保证优惠的条件与实在的价值。"}}$mig$::jsonb, "status" = 'published' WHERE "slug" = 'city-dwellers';
