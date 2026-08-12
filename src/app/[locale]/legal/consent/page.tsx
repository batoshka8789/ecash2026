import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { ConsentAccept } from '@/components/legal/ConsentAccept';
import { pageMetadata } from '@/lib/metadata';
import {
  CONSENT_BLOCKS,
  CONSENT_INTRO,
  CONSENT_TITLE,
  CONSENT_VERSION,
} from '@/lib/legal/consent';

/**
 * Полный текст согласия на обработку персональных данных. Открывается по
 * ссылке из чекбокса на регистрации — поэтому страница публичная и лёгкая:
 * человек уходит сюда прямо из формы и должен вернуться в неё одним нажатием.
 *
 * Текст один на все языки: юридически значима русская редакция (см.
 * комментарий в lib/legal/consent.ts).
 */
export default async function ConsentPage() {
  const t = await getTranslations('legal');

  return (
    <main id="main" className="flex-1 pb-16 pt-6">
      <div className="mx-auto w-full max-w-[760px] px-4 md:px-6">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-brand transition-opacity hover:opacity-80"
        >
          <Icon name="arrow_back" size={20} />
          {t('backToSignup')}
        </Link>

        <article className="mt-6 rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
          <h1 className="text-xl font-bold leading-tight text-text-default sm:text-3xl">
            {CONSENT_TITLE}
          </h1>
          <p className="mt-2 text-xs text-text-disabled">
            {t('version', { version: CONSENT_VERSION })}
          </p>

          <p className="mt-6 text-sm leading-relaxed text-text-disabled sm:text-base">
            {CONSENT_INTRO}
          </p>

          {CONSENT_BLOCKS.map((block, i) => {
            if (block.kind === 'section') {
              return (
                <h2
                  key={i}
                  className="mt-8 text-base font-bold text-text-default sm:text-lg"
                >
                  {block.title}
                </h2>
              );
            }
            if (block.kind === 'list') {
              return (
                <ul
                  key={i}
                  className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-text-disabled sm:text-base"
                >
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p
                key={i}
                className="mt-3 text-sm leading-relaxed text-text-disabled sm:text-base"
              >
                {block.text}
              </p>
            );
          })}

          {/* Согласие даётся здесь же — возвращаться на форму за галочкой
              не нужно, она проставится сама (см. ConsentAccept). */}
          <ConsentAccept />
        </article>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'consent', '/legal/consent');
}
