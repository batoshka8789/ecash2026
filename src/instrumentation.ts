/**
 * Выполняется один раз при старте сервера, до приёма трафика.
 * Невалидное окружение роняет процесс сразу — health-check это увидит,
 * вместо 500 на первом запросе пользователя.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./server/env');
    // снапшоттер курсов — только в живом сервере, не при сборке
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      // Схему приводим к коду ДО первого запроса и до снапшоттера: он сам
      // пишет в БД. Раньше миграции не запускал никто (в контейнере только
      // `node server.js`), и прод-база отставала от схемы репозитория.
      const { runMigrations } = await import('./server/db/migrate');
      await runMigrations();

      // Связь с Ecash: проверяем и громко пишем результат в лог. Процесс не
      // роняем — без апстрима лендинг и новости работают, а сбой бывает
      // временным. Главное, чтобы при переезде на боевые ключи ошибка была
      // видна сразу, а не всплыла у первого посетителя.
      const { checkEcashConnection } = await import('./server/startup-check');
      void checkEcashConnection();

      const { startSnapshotter } = await import('./server/jobs/snapshots');
      startSnapshotter();

      // Разовый доперевод новостей (en/kk/zh) — в фоне, старт не ждёт:
      // закрывает записи, созданные до автоперевода, и упавшие попытки.
      const { sweepNewsTranslations } = await import('./server/news-autotranslate');
      setTimeout(() => void sweepNewsTranslations(), 15_000);
    }
  }
}
