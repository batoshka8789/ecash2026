'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { FranchiseModal } from './FranchiseModal';

const actions = [
  { key: 'individualRate', icon: 'badge', href: '/individual-rate' },
  { key: 'booking', icon: 'gavel', href: '/booking' },
  { key: 'notify', icon: 'notifications', href: '/subscribe' },
  { key: 'franchise', icon: 'groups', href: null },
  { key: 'news', icon: 'language', href: '/news' },
] as const;

/**
 * Пять карточек-действий под шапкой. В макете это «modal/service list».
 * С 768 это НЕ лента фиксированной ширины, а ряд, растянутый по контентной
 * колонке: у карточек grow=1 и alignSelf=STRETCH, и пять штук с зазором
 * ровно заполняют колонку — 5×224+4×20=1200 на 1920, 5×179.2+4×20=976 на
 * 1024, 5×134.8+4×12=722 на 768. Отсюда и разный горизонтальный паддинг
 * плитки: 32 / 16 / 8. На 360/480 — прозрачные ярлыки 108×142 вплотную,
 * и вот там лента действительно прокручивается.
 *
 * Прежняя версия держала 224px на всех ширинах: так печатала спека, потому
 * что выгрузка проваливалась в мастер-компонент и для каждого брейкпоинта
 * повторяла геометрию 1920. Реальные значения — в переопределениях инстанса
 * (scripts/fig-resolve.mjs, design/raw/spec/resolved/).
 *
 * Это основная навигация приложения — БЕЗ анимации появления:
 * контент обязан быть видимым мгновенно (фоновые вкладки замораживают
 * таймлайны анимаций, и навигация «зависала» невидимой).
 *
 * «Открыть франшизу» — это ярлык быстрого действия, как и остальные
 * четыре карточки, а не переход на маркетинговую страницу: открывает
 * всплывающую форму заявки (FranchiseModal), а не редиректит на /franchise.
 */
export function ActionCards() {
  const t = useTranslations('home.actions');
  const [franchiseOpen, setFranchiseOpen] = useState(false);

  return (
    <>
      {/*
       * Боковые поля ленты в макете свои: 16 на 360, 0 на 480 (лента уходит
       * в край экрана), дальше — поля контентной колонки 20/24. Поэтому
       * container-page здесь развёрнут вручную.
       *
       * Зазор до шапки (32 на 360/480 и 100 на ≥768) держит блок тоста —
       * он один и тот же независимо от того, показан тост или плашка адреса,
       * поэтому своего верхнего отступа у ленты нет.
       *
       * pb-10/-mb-10: тень плитки уходит на 40px вниз, а overflow-x у ленты
       * режет и по вертикали — даём запас и гасим его отрицательным полем,
       * чтобы межсекционный шаг не поехал.
       */}
      <div className="mx-auto -mb-10 flex w-full max-w-[1232px] overflow-x-auto px-4 pb-10 min-[480px]:px-0 md:max-w-[1240px] md:gap-3 md:px-5 lg:max-w-[1248px] lg:gap-5 lg:px-6">
        {actions.map(({ key, icon, href }) => {
          const content = (
            <>
              {/* кружок в макете 54×54 на 360/480 и 50×54 с 768 — не квадрат */}
              <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[20px] bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110 md:w-[50px]">
                <Icon name={icon} size={20} filled />
              </span>
              {/*
               * С 768 подпись — Inter Semi Bold 14. Интерлиньяж берём 15px:
               * в макете у стиля стоит 1×, но собственные высоты текстовых
               * боксов кратны 15 (15/30/45), и на них построена высота плитки.
               */}
              <span className="text-xs font-medium leading-[1.3] text-text-default md:font-inter md:text-sm md:font-semibold md:leading-[15px]">
                {t(key)}
              </span>
            </>
          );
          /*
           * justify-start, а не center: в макете содержимое прижато к верхнему
           * паддингу, поэтому кружки одно- и двухстрочных плиток стоят на одной
           * высоте. Обводка — только с 768: на 360/480 у плитки нет ни заливки,
           * ни обводки, и лишний прозрачный 1px съедал ширину подписи.
           */
          const cardCls =
            'group flex min-h-[142px] w-full cursor-pointer flex-col items-center justify-start gap-2 rounded-[20px] px-1 py-5 text-center shadow-[0_16px_32px_-8px_rgb(12_12_13/0.4)] transition-[background,transform] duration-200 hover:-translate-y-0.5 md:gap-4 md:border md:border-stroke-surface2 md:bg-surface-page-surf2 md:px-2 md:hover:bg-comp-surface2-hover lg:px-4 xl:px-8';
          return (
            /* flex у обёртки — чтобы плитка тянулась на всю высоту ряда:
               в макете у всех пяти alignSelf=STRETCH, и заливка с обводкой
               обязаны обрываться на одной линии независимо от длины подписи */
            <div key={key} className="flex w-[108px] shrink-0 md:w-auto md:min-w-0 md:flex-1">
              {href ? (
                <Link href={href} className={cardCls}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => setFranchiseOpen(true)} className={cardCls}>
                  {content}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <FranchiseModal open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />
    </>
  );
}
