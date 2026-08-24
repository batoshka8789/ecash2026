import { useTranslations } from 'next-intl';
import { PageShell } from '@/components/layout/PageShell';
import { Icon } from '@/components/ui/Icon';
import { pageMetadata } from '@/lib/metadata';
import { LICENSE_CITIES, licenseHref, type License } from '@/lib/licenses';

/**
 * «Документы» из футера: лицензии Нацбанка по отделениям, сгруппированные
 * по городам. Каждая строка открывает свой PDF из public/documents/licenses.
 *
 * Отдельной карточки на каждый город в макете нет, поэтому берём ритм
 * страниц-флоу (booking/individual-rate): одна плита surf1 с обводкой
 * stroke-surface1 и заголовком 32px, внутри — города секциями, а сами
 * документы — плитками surf2 r20, как строки списка отделений.
 *
 * Список статический: PDF лежат в репозитории, ходить за ними в Ecash API
 * незачем — страница остаётся полностью серверной и попадает в SSG.
 */
export default function DocumentsLicensePage() {
  const t = useTranslations('documents');

  return (
    <PageShell crumbLabel={t('crumb')}>
      <div className="container-page pb-6 pt-5">
        <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
          <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
            {t('title')}
          </h1>

          <div className="mt-6 flex flex-col gap-8 md:mt-8 md:gap-10">
            {LICENSE_CITIES.map((city) => (
              <section key={city.key}>
                {/* Подпись города — та же строка-разделитель, что у групп
                    в списке отделений: иконка бренда и название. */}
                <h2 className="flex items-center gap-2 text-base font-medium leading-5 text-text-default md:gap-2.5 md:text-xl">
                  <Icon name="location_on" size={20} className="text-text-brand" filled />
                  {t(`cities.${city.key}`)}
                </h2>

                {/* С 1024 две колонки: строка короткая, на колонке 1200
                    одноколоночный список оставлял половину плиты пустой.
                    Порядок чтения при этом сохраняется — слева направо. */}
                <ul className="mt-3 grid gap-2 md:mt-4 md:gap-3 lg:grid-cols-2">
                  {city.licenses.map((license) => (
                    <li key={license.file}>
                      <LicenseLink license={license} hint={t('hint')} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

/**
 * Плитка документа. Ссылка обычная (<a>, не next/link): файл статический,
 * маршрутизатору Next тут нечего перехватывать, а target="_blank" оставляет
 * страницу открытой — из списка обычно смотрят несколько лицензий подряд.
 */
function LicenseLink({ license, hint }: { license: License; hint: string }) {
  return (
    <a
      href={licenseHref(license)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full items-center gap-3 rounded-[20px] border border-stroke-surface1 bg-surface-page-surf2 p-3 transition-colors hover:border-stroke-brand hover:bg-comp-surface2-hover md:gap-4 md:p-4"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-hardsoft text-text-brand transition-colors group-hover:bg-brand group-hover:text-text-always-white md:h-12 md:w-12">
        <Icon name="description" size={24} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-[1.3] text-text-default md:text-base md:leading-5">
        {license.name}
        {/* Формат и новая вкладка видны глазом (значок PDF + стрелка),
            но не экранному диктору — ему их проговаривает эта подпись. */}
        <span className="sr-only"> — {hint}</span>
      </span>
      <Icon
        name="arrow_outward"
        size={20}
        className="shrink-0 text-text-disabled transition-colors group-hover:text-text-brand"
      />
    </a>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'documents', '/documents-license');
}
