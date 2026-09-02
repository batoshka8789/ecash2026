import { useTranslations } from 'next-intl';
import { PageShell } from '@/components/layout/PageShell';
import { pageMetadata } from '@/lib/metadata';
import { TERMS_BLOCKS, TERMS_TITLE } from '@/lib/legal/terms';

/**
 * Пользовательское соглашение — текст документа страницей сайта, без обвязки.
 * Ровно тот же приём, что и у /legal/privacy (см. её же комментарий): документ
 * читают чаще всего с телефона, поэтому здесь только колонка текста — ни
 * карточки, ни оглавления, ни кнопок.
 *
 * В отличие от /legal/privacy здесь нет groupBlocks: в исходнике нет ни
 * одного маркированного списка (см. комментарий в lib/legal/terms.ts), так
 * что рендерить нечего группировать — заголовки и абзацы идут подряд как
 * в документе.
 *
 * Текст берётся из src/lib/legal/terms.ts и совпадает с документом заказчика
 * слово в слово. Страница полностью серверная — ни состояния, ни данных.
 */
export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <PageShell crumbLabel={t('crumb')}>
      <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
        {/* Колонка по центру страницы, ширина 720 — та же мера, что у
            /legal/privacy, и по той же причине (см. её комментарий). */}
        <article lang="ru" className="mx-auto max-w-[720px]">
          <header className="border-b border-stroke-surface1 pb-8 text-center md:pb-10">
            <h1 className="text-balance text-xl font-semibold leading-[1.25] tracking-[0.01em] text-text-default md:text-[32px]">
              {TERMS_TITLE}
            </h1>
          </header>

          {TERMS_BLOCKS.map((block, i) =>
            block.kind === 'heading' ? (
              <h2
                key={i}
                className="mt-10 text-balance text-center text-[15px] font-semibold uppercase leading-[1.4] tracking-[0.06em] text-text-default md:mt-14 md:text-base"
              >
                {block.text}
              </h2>
            ) : (
              <p
                key={i}
                className="mt-4 hyphens-auto text-[15px] leading-[1.75] text-text-default md:mt-5 md:text-base md:text-justify"
              >
                {block.text}
              </p>
            ),
          )}
        </article>
      </div>
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'terms', '/legal/terms');
}
