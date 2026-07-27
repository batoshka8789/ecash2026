'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';

const actions = [
  { key: 'individualRate', icon: 'group', href: '/individual-rate', filled: false },
  { key: 'booking', icon: 'gavel', href: '/booking', filled: true },
  { key: 'notify', icon: 'notifications', href: '/subscribe', filled: true },
  { key: 'franchise', icon: 'diversity_3', href: '/franchise', filled: true },
  { key: 'news', icon: 'language', href: '/news', filled: true },
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
 * карточки — stroke-surface3, не stroke-surface2: у surface2 в светлой
 * теме тот же цвет, что и у фона карточки (surf2), рамка становится
 * буквально невидимой. shrink-0 на бейдже обязателен: карточка на
 * десктопе фиксированной высоты (h-[142px]), и без него бейдж сжимался
 * у пунктов с трёхстрочной подписью — расплывался по высоте относительно
 * соседей.
 *
 * Размер бейджа (50×54) и иконки (24px) сверены по пиксельным экспортам
 * PNG из Figma (замерено через PIL: bbox глифа ~22–26px во всех пяти
 * значках). Цвет глифа — не сплошной text-default: по референсу он
 * заметно светлее чистого белого/чёрного, а сам оттенок отличается по
 * теме (в тёмной теме — почти полная яркость text-default, в светлой —
 * заметно приглушённый), поэтому приглушение (80%) включено только под
 * светлую тему через селектор по data-theme, а не через фиксированную
 * прозрачность на обе темы сразу.
 *
 * У «group» (individualRate) в референсе глиф контурный (FILL 0) — у
 * остальных четырёх сплошной. «Открыть франшизу» — diversity_3, а не
 * handshake: реальный Material Symbols «handshake» это ладонь/рукопожатие
 * одной кистью, а в референсе — двое людей (плюс мелкий ромб-акцент над
 * ними, которого нет ни в одном стандартном глифе — не воспроизведён,
 * похоже на отдельный декоративный слой поверх иконки в макете).
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
        {actions.map(({ key, icon, href, filled }) => (
          <Link
            key={key}
            href={href}
            className="group flex w-28 shrink-0 snap-start cursor-pointer flex-col items-center gap-3 py-2 text-center sm:h-[142px] sm:w-56 sm:justify-center sm:gap-4 sm:rounded-[20px] sm:border sm:border-stroke-surface3 sm:bg-surface-page-surf2 sm:px-8 sm:py-5 sm:transition-[background,transform] sm:duration-200 sm:hover:-translate-y-0.5 sm:hover:bg-comp-surface2-hover"
          >
            <span className="flex h-[54px] w-[50px] shrink-0 items-center justify-center rounded-[20px] bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110">
              <Icon
                name={icon}
                size={24}
                filled={filled}
                className="[html[data-theme=light]_&]:opacity-80"
              />
            </span>
            <span className="text-sm leading-tight text-text-default">{t(key)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
