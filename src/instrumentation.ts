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
      const { startSnapshotter } = await import('./server/jobs/snapshots');
      startSnapshotter();
    }
  }
}
