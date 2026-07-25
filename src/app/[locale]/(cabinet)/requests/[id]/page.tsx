import { notFound } from 'next/navigation';
import { RequestDetail } from '@/components/requests/RequestDetail';
import { pageMetadata } from '@/lib/metadata';
import { readSession, userToken } from '@/server/session';
import { getRequest } from '@/server/ecash/endpoints/reserve';
import { demoGet, isDemoToken } from '@/server/demo/store';

/**
 * Карточка заявки. Существование проверяем на сервере ДО отдачи страницы:
 * иначе несуществующий id отдавал бы 200 и пустой скелетон, а сообщение
 * «не найдено» появлялось бы только после гидратации (soft-404).
 *
 * Данные не пробрасываем в компонент: он клиентский и живёт на поллинге +
 * SSE, поэтому сам запросит актуальную версию — здесь только гейт 404.
 */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) notFound();

  const token = await userToken();
  // без токена страницу не покажет layout кабинета — гейт здесь только для 404
  if (token) {
    try {
      if (isDemoToken(token)) {
        const s = await readSession();
        if (!s || !demoGet(s.accountId, requestId)) notFound();
      } else {
        await getRequest(token, requestId);
      }
    } catch {
      // чужая или несуществующая заявка — upstream отвечает REQUEST_NOT_FOUND
      notFound();
    }
  }

  return (
    <main id="main" className="flex-1 pb-4">
      <RequestDetail params={params} />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'requests', '/requests', { noIndex: true });
}
