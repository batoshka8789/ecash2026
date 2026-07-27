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
 * Пять карточек-действий под шапкой. В макете это «modal/service list»:
 * с 768 — плитки на surf2 в ряд по пять (224×142 на 1920), на 360/480 —
 * горизонтальная лента из прозрачных ярлыков 108×142 без фона и обводки.
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
      <div className="container-page flex overflow-x-auto pt-6 sm:grid sm:grid-cols-5 sm:gap-3 sm:pt-7 lg:gap-5">
        {actions.map(({ key, icon, href }) => {
          const content = (
            <>
              <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[20px] bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110 sm:h-[50px] sm:w-[50px]">
                <Icon name={icon} size={20} filled />
              </span>
              <span className="text-xs font-medium leading-tight text-text-default sm:text-sm sm:font-semibold">
                {t(key)}
              </span>
            </>
          );
          const cardCls =
            'group flex min-h-[142px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-transparent px-1 py-5 text-center transition-[background,transform] duration-200 hover:-translate-y-0.5 sm:gap-4 sm:border-stroke-surface2 sm:bg-surface-page-surf2 sm:px-8 sm:shadow-[0_16px_32px_-8px_rgb(12_12_13/0.4)] sm:hover:bg-comp-surface2-hover';
          return (
            <div key={key} className="w-[108px] shrink-0 sm:w-auto">
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
