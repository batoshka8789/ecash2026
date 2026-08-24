import { useTranslations } from 'next-intl';
import { PageShell } from '@/components/layout/PageShell';
import { pageMetadata } from '@/lib/metadata';
import { PRIVACY_BLOCKS, PRIVACY_SUBTITLE, PRIVACY_TITLE } from '@/lib/legal/privacy';

/**
 * Политика конфиденциальности — текст документа страницей сайта, без обвязки.
 * Раньше ссылка из футера отдавала PDF: на телефоне это чужой просмотрщик
 * с шестью страницами А4, где текст надо разводить пальцами.
 *
 * Здесь сознательно ничего, кроме текста: ни карточки-плиты, ни оглавления,
 * ни кнопок — только колонка по центру страницы. Документ читают подряд,
 * и любой элемент управления рядом с ним лишь отвлекает.
 *
 * Набор повторяет оригинал: название и заголовки разделов по центру, текст
 * выключен по формату с автопереносами.
 *
 * Текст берётся из src/lib/legal/privacy.ts и совпадает с документом
 * заказчика слово в слово — там же сказано, почему он не в messages/*.json.
 *
 * Страница полностью серверная — ни состояния, ни данных, только статика.
 */
export default function PrivacyPolicyPage() {
  const t = useTranslations('privacy');

  return (
    <PageShell crumbLabel={t('crumb')}>
      <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
        {/*
          Колонка по центру страницы, ширина 720 — при кегле 16 это около
          восьмидесяти знаков в строке, предел, после которого глаз теряет
          начало следующей.

          lang="ru": текст документа один на все языки (юридически значима
          русская редакция), и это нужно сказать явно — иначе на /en диктор
          прочтёт русский текст английскими правилами, а переносы встанут
          по английскому словарю.
        */}
        <article lang="ru" className="mx-auto max-w-[720px]">
          {/* Шапка документа повторяет оригинал: название и подзаголовок
              стоят по центру, под ними — воздух до первого абзаца. */}
          <header className="border-b border-stroke-surface1 pb-8 text-center md:pb-10">
            <h1 className="text-balance text-xl font-semibold leading-[1.25] tracking-[0.01em] text-text-default md:text-[32px]">
              {PRIVACY_TITLE}
            </h1>
            <p className="mt-2 text-pretty text-base leading-[1.35] text-text-disabled md:mt-3 md:text-xl">
              {PRIVACY_SUBTITLE}
            </p>
          </header>

          {groupBlocks(PRIVACY_BLOCKS).map((block, i) =>
            block.kind === 'list' ? (
              <ul
                key={i}
                className="mt-4 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.75] text-text-default marker:text-text-brand md:mt-5 md:pl-6 md:text-base md:text-justify"
              >
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            ) : block.kind === 'heading' ? (
              // заголовки разделов в документе тоже стоят по центру
              <h2
                key={i}
                className="mt-10 text-balance text-center text-[15px] font-semibold uppercase leading-[1.4] tracking-[0.06em] text-text-default md:mt-14 md:text-base"
              >
                {block.text}
              </h2>
            ) : (
              // Выключка по формату — как в оригинале, но только с 768:
              // на колонке в 340 даже с переносами justify разгоняет
              // межсловные пробелы до дыр. Переносы включены везде.
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

type RenderBlock = { kind: 'heading' | 'text'; text: string } | { kind: 'list'; items: string[] };

/** Подряд идущие пункты документа — один список, а не набор одиночных строк. */
function groupBlocks(blocks: typeof PRIVACY_BLOCKS): RenderBlock[] {
  const out: RenderBlock[] = [];
  for (const block of blocks) {
    const last = out.at(-1);
    if (block.kind === 'item') {
      if (last?.kind === 'list') last.items.push(block.text);
      else out.push({ kind: 'list', items: [block.text] });
    } else {
      out.push({ kind: block.kind, text: block.text });
    }
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'privacy', '/legal/privacy');
}
