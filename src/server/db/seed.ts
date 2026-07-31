import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { competitors, news } from './schema';

/**
 * Идемпотентный сид справочного контента (новости, конкуренты).
 * Запуск: npx tsx src/server/db/seed.ts — или npm run db:seed.
 */
async function main() {
  const client = postgres(process.env.DATABASE_URL ?? 'postgres://ecash:ecash@localhost:5432/ecash', {
    max: 1,
  });
  const db = drizzle(client);

  // Только имя и цвет: курсы конкурентов НЕ хранятся — /api/rates выводит их
  // из живого курса отделения, чтобы они обновлялись вместе с нашими.
  await db
    .insert(competitors)
    .values([
      { id: 'c1', nameKey: 'blue', color: 'var(--color-competitor-3)' },
      { id: 'c2', nameKey: 'green', color: 'var(--color-competitor-2)' },
      { id: 'c3', nameKey: 'red', color: 'var(--color-competitor-1)' },
    ])
    .onConflictDoNothing();

  const day = 86_400_000;
  await db
    .insert(news)
    .values([
      {
        slug: 'travelers',
        image: '/img/news-travelers.webp',
        status: 'published',
        translations: {
          ru: {
            title: 'Путешественники',
            excerpt: '',
            body: 'В подготовке к поездке важно всё продумать заранее, включая обмен валюты. Наши услуги помогут вам быстро и без лишних сложностей получить нужную сумму, чтобы вы могли сосредоточиться на отдыхе или работе, а не искать обменники по приезду. Мы предлагаем выгодные условия, а также профессиональные консультации для тех, кто хочет быть уверен в каждом этапе своего путешествия.',
          },
          en: {
            title: 'Travelers',
            excerpt: '',
            body: 'When preparing for a trip, it is important to think everything through in advance, including currency exchange. Our services help you get the amount you need quickly and without unnecessary hassle, so you can focus on your holiday or work instead of looking for exchange offices on arrival. We offer favourable terms and professional advice for those who want to feel confident at every stage of their journey.',
          },
          kk: {
            title: 'Саяхатшылар',
            excerpt: '',
            body: 'Сапарға дайындықта бәрін алдын ала ойластыру маңызды, соның ішінде валюта айырбастауды да. Біздің қызметтеріміз қажетті соманы жылдам әрі артық қиындықсыз алуға көмектеседі, сонда сіз келген бойда айырбастау пункттерін іздеудің орнына демалысқа немесе жұмысқа зейін қоя аласыз. Біз тиімді шарттар, сондай-ақ сапарының әр кезеңіне сенімді болғысы келетіндерге кәсіби кеңес ұсынамыз.',
          },
          zh: {
            title: '旅行者',
            excerpt: '',
            body: '出行前的准备需要面面俱到，货币兑换也不例外。我们的服务让您快速、省心地换到所需金额，无需抵达后四处寻找兑换点，从而专心享受旅程或处理工作。我们提供优惠的条件和专业的建议，让您在旅途的每一个环节都安心从容。',
          },
        },
        publishedAt: new Date(Date.now() - 2 * day),
      },
      {
        slug: 'city-dwellers',
        image: '/img/news-city.webp',
        status: 'published',
        translations: {
          ru: {
            title: 'Жители городов',
            excerpt: '',
            body: 'Обмен валюты нужен каждому — будьте то для сбережений, выгодных вложений или крупных покупок. Мы делаем обмен простым и быстрым, обеспечивая выгодные условия и реальную ценность на каждом этапе.',
          },
          en: {
            title: 'City dwellers',
            excerpt: '',
            body: 'Everyone needs currency exchange — whether for savings, profitable investments or large purchases. We make exchange simple and fast, providing favourable terms and real value at every stage.',
          },
          kk: {
            title: 'Қала тұрғындары',
            excerpt: '',
            body: 'Валюта айырбастау әркімге қажет — жинақ үшін де, тиімді салымдар немесе ірі сатып алулар үшін де. Біз айырбастауды қарапайым әрі жылдам етеміз, әр кезеңде тиімді шарттар мен нақты құндылықты қамтамасыз етеміз.',
          },
          zh: {
            title: '城市居民',
            excerpt: '',
            body: '无论是储蓄、稳健投资还是大额消费，每个人都会用到货币兑换。我们让您轻松快捷地完成兑换，并在每一个环节保证优惠的条件与实在的价值。',
          },
        },
        publishedAt: new Date(Date.now() - 3 * day),
      },
    ])
    .onConflictDoNothing();

  await client.end();
  console.warn('seed: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
