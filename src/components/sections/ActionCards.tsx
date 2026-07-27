'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { FranchiseModal } from './FranchiseModal';

const actions = [
  { key: 'individualRate', icon: 'group', href: '/individual-rate' },
  { key: 'booking', icon: 'gavel', href: '/booking' },
  { key: 'notify', icon: 'notifications', href: '/subscribe' },
  { key: 'franchise', icon: 'handshake', href: null },
  { key: 'news', icon: 'language', href: '/news' },
] as const;

/**
 * Пять карточек-действий под шапкой — свайп-ряд, а не резиновая сетка:
 * на узких экранах и когда окну не хватает ширины на все пять (1200px
 * на десктопе), ряд не сжимается и не переносится, а прокручивается
 * свайпом/колесом со scroll-snap на каждую карточку. Пропорции карточки
 * различаются по макету: на мобильном — портретная (144×192, ýже и выше,
 * чтобы в один экран влезало больше двух), на десктопе — альбомная
 * фиксированная 224×142. Это основная навигация приложения — БЕЗ анимации
 * появления: контент обязан быть видимым мгновенно (фоновые вкладки
 * замораживают таймлайны анимаций, и навигация «зависала» невидимой).
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
      <div className="container-page">
        <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pt-6 sm:gap-5 sm:pt-7">
          {actions.map(({ key, icon, href }) => {
            const content = (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110">
                  <Icon name={icon} size={22} filled />
                </span>
                <span className="text-sm leading-tight text-text-default">{t(key)}</span>
              </>
            );
            const cardCls =
              'group flex h-48 w-36 shrink-0 snap-start cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border border-stroke-surface2 bg-surface-page-surf2 px-5 py-6 text-center shadow-[0_16px_32px_-8px_rgba(12,12,13,0.4)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-comp-surface2-hover sm:h-[142px] sm:w-56 sm:gap-4 sm:px-8 sm:py-5';
            return href ? (
              <Link key={key} href={href} className={cardCls}>
                {content}
              </Link>
            ) : (
              <button key={key} type="button" onClick={() => setFranchiseOpen(true)} className={cardCls}>
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <FranchiseModal open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />
    </>
  );
}
