'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';

const actions = [
  { key: 'individualRate', icon: 'badge', href: '/individual-rate' },
  { key: 'booking', icon: 'gavel', href: '/booking' },
  { key: 'notify', icon: 'notifications', href: '/subscribe' },
  { key: 'franchise', icon: 'groups', href: '/franchise' },
  { key: 'news', icon: 'language', href: '/news' },
] as const;

/** Пять карточек-действий под шапкой (224×141 в макете). */
export function ActionCards() {
  const t = useTranslations('home.actions');

  return (
    <div className="container-page grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3 sm:gap-4 sm:pt-7 lg:grid-cols-5 lg:gap-5">
      {actions.map(({ key, icon, href }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={href}
            className="group flex h-28 flex-col items-center justify-center gap-2.5 rounded-[20px] border border-stroke-surface2 bg-surface-page-surf2 px-4 text-center shadow-[0_8px_16px_rgb(0_0_0/0.25)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-comp-surface2-hover sm:h-[142px] sm:gap-4 sm:px-8 sm:py-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-page-surf3 text-text-default transition-transform duration-200 group-hover:scale-110 sm:h-10 sm:w-10">
              <Icon name={icon} size={20} filled className="sm:text-[22px]" />
            </span>
            <span className="text-xs leading-tight text-text-default sm:text-sm">{t(key)}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
