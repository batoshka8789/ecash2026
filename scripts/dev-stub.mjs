/**
 * Дев-сервер поверх локальной заглушки апстрима — режим «посмотреть вёрстку».
 *
 *   npm run dev:stub
 *
 * Поднимает scripts/stub-upstream.mjs и запускает next dev с
 * ECASH_API_BASE_URL, указывающим на неё. Переменные окружения процесса
 * приоритетнее .env.local, поэтому сам .env.local править не нужно.
 *
 * Нужен потому, что без настоящего ECASH_CLIENT_SECRET апстрим отвечает 401
 * и вместо курсов, отделений и графика страница рисует карточки ошибок.
 * Данные заглушки выдуманные — это стенд для проверки вёрстки.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';

const STUB_PORT = Number(process.env.STUB_PORT ?? 4010);
const DEV_PORT = process.env.PORT ?? "3101";

const portBusy = (port) =>
  new Promise((resolve) => {
    const s = net
      .createServer()
      .once('error', () => resolve(true))
      .once('listening', () => s.close(() => resolve(false)))
      .listen(port, '127.0.0.1');
  });

const children = [];
const stopAll = () => {
  for (const c of children) c.kill('SIGTERM');
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stopAll(), process.exit(0)));

if (await portBusy(STUB_PORT)) {
  console.log(`заглушка уже слушает :${STUB_PORT}, переиспользуем`);
} else {
  const stub = spawn(process.execPath, ['scripts/stub-upstream.mjs', String(STUB_PORT)], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  children.push(stub);
  // даём заглушке подняться, иначе первый же запрос курсов упрётся в ECONNREFUSED
  await new Promise((r) => setTimeout(r, 400));
}

const dev = spawn('npx', ['next', 'dev', '--port', DEV_PORT], {
  stdio: 'inherit',
  env: { ...process.env, ECASH_API_BASE_URL: `http://127.0.0.1:${STUB_PORT}` },
});
children.push(dev);
dev.on('exit', (code) => {
  stopAll();
  process.exit(code ?? 0);
});
