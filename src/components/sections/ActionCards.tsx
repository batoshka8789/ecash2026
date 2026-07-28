'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MaskGlyph } from '@/components/ui/MaskGlyph';

/**
 * Глифы нав-панели — АЛЬФА-МАСКИ, извлечённые напрямую из пиксельных
 * PNG-экспортов макета (public/img/actions/*, 8x для ретины): ни один
 * шрифтовой/векторный набор не совпал с экспортами на 100% (Iconsax дал
 * IoU 0.81–0.84 на трёх иконках, «люди с ромбом» и «человек с купюрами» —
 * составные глифы, которых нет ни в одном наборе). Маска красится
 * background-цветом (currentColor), поэтому темы работают как обычно.
 * w/h — размер глифа в CSS-пикселях, 1:1 с экспортом бейджа 50×54.
 */
const actions = [
  { key: 'individualRate', glyph: 'individual-rate', w: 26, h: 24, href: '/individual-rate' },
  { key: 'booking', glyph: 'booking', w: 26, h: 26, href: '/booking' },
  { key: 'notify', glyph: 'notify', w: 26, h: 28, href: '/subscribe' },
  { key: 'franchise', glyph: 'franchise', w: 28, h: 24, href: '/franchise' },
  { key: 'news', glyph: 'news', w: 26, h: 26, href: '/news' },
] as const;


/**
 * Пять карточек-действий под шапкой — свайп-ряд, а не резиновая сетка:
 * на узких экранах и когда окну не хватает ширины на все пять (1200px
 * на десктопе), ряд не сжимается и не переносится, а прокручивается
 * свайпом/колесом со scroll-snap на каждую карточку.
 *
 * На мобильном — только иконка-плашка и подпись, без внешнего контейнера
 * (по макету). На десктопе (sm:+) — обратно карточка с фоном/рамкой,
 * как было изначально: на ПК-ширине пункт без оболочки читался слишком
 * бедно и неотличимо от мобильной версии. Без тени: жёсткая тёмная
 * тень из тёмной темы на светлом фоне выглядела грязным пятном —
 * в референсе (светлая тема) карточка плоская, держится только цветом
 * заливки/бордером.
 *
 * Бейдж иконки — rounded-[20px] (как остальные крупные элементы в
 * макете), а не rounded-xl: по референсу бейдж заметно круглее. Обводка
 * карточки в тёмной теме — stroke-surface2 (#404040), по точной подписи
 * макета; в светлой теме тот же токен совпадает с фоном самой карточки
 * (surf2) и рамка становится невидимой, поэтому светлая тема форсированно
 * держится на stroke-surface3, как и было. shrink-0 на бейдже обязателен: карточка на
 * десктопе фиксированной высоты (h-[142px]), и без него бейдж сжимался
 * у пунктов с трёхстрочной подписью — расплывался по высоте относительно
 * соседей.
 *
 * Размер бейджа (50×54) сверен по пиксельным экспортам PNG из Figma.
 * Цвет глифа в светлой теме приглушён (80%): по референсу он мягче
 * чистого чёрного, в тёмной — полная яркость text-default.
 *
 * Это основная навигация приложения — БЕЗ анимации появления: контент
 * обязан быть видимым мгновенно (фоновые вкладки замораживают таймлайны
 * анимаций, и навигация «зависала» невидимой).
 *
 * «Открыть франшизу» ведёт на полноценный лендинг /franchise — не на
 * быструю модалку-заявку: сама страница уже полностью доработана
 * (ТЗ «Лендос Франшиза»), прятать её за модалкой больше не нужно.
 */
export function ActionCards() {
  const t = useTranslations('home.actions');

  return (
    <div className="container-page">
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto pt-6 sm:gap-5 sm:pt-7">
        {actions.map(({ key, glyph, w, h, href }) => (
          <Link
            key={key}
            href={href}
            // пять ссылок на самом видном месте каждой страницы — с
            // дефолтным prefetch все пять тянут RSC одновременно при
            // каждом заходе/смене языка, хотя кликают обычно одну
            prefetch={false}
            className="group flex w-28 shrink-0 snap-start cursor-pointer flex-col items-center gap-3 py-2 text-center sm:h-[142px] sm:w-56 sm:justify-center sm:gap-4 sm:rounded-[20px] sm:border sm:border-stroke-surface2 sm:bg-surface-page-surf2 sm:px-8 sm:py-5 sm:transition-[background,transform] sm:duration-200 sm:hover:-translate-y-0.5 sm:hover:bg-comp-surface2-hover [html[data-theme=light]_&]:sm:border-stroke-surface3"
          >
            <span className="flex h-[54px] w-[50px] shrink-0 items-center justify-center rounded-[20px] bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110 [html[data-theme=light]_&]:text-text-default/80">
              <MaskGlyph src={`/img/actions/${glyph}.png`} w={w} h={h} />
            </span>
            <span className="text-sm leading-tight text-text-default">{t(key)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
