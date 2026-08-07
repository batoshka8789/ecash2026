'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { usePush } from '@/lib/usePush';
import { useAuth } from '@/lib/auth';

/**
 * Карточка «Уведомления в браузере».
 *
 * До сих пор подписка на курс срабатывала молча: отметка ставилась в базе, и
 * человек узнавал об этом, только когда сам заходил на сайт. Здесь он
 * разрешает браузеру показывать уведомления, и сообщение приходит в момент
 * события — даже с закрытой вкладкой.
 *
 * Карточка сама себя прячет там, где она бессмысленна: гостю (подписки
 * привязаны к аккаунту), на стенде без ключей VAPID и в браузере без
 * поддержки push. Показывать неработающий переключатель хуже, чем не
 * показывать ничего.
 */
export function PushCard({ className }: { className?: string }) {
  const t = useTranslations('push');
  const { authed } = useAuth();
  const { state, busy, error, enable, disable } = usePush();

  if (!authed) return null;
  if (state === 'loading' || state === 'disabled' || state === 'unsupported') return null;

  const on = state === 'on';
  const denied = state === 'denied';

  return (
    <section
      className={clsx(
        'flex flex-col gap-4 rounded-[22px] border p-4 transition-colors sm:flex-row sm:items-center sm:gap-5 md:rounded-[28px] md:p-6',
        on
          ? 'border-stroke-brand bg-brand-hardsoft'
          : 'border-stroke-surface1 bg-surface-page-surf1',
        className,
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors',
          on ? 'bg-brand text-text-always-white' : 'bg-surface-page-surf2 text-text-brand',
        )}
      >
        <Icon name={denied ? 'notifications_off' : 'notifications_active'} size={28} filled={on} />
        {/* мягкий пульс только во включённом состоянии — знак, что канал живой */}
        {on && (
          <span className="absolute inset-0 animate-ping rounded-2xl bg-brand opacity-20 motion-reduce:animate-none" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-text-default md:text-lg">
          {denied ? t('deniedTitle') : on ? t('onTitle') : t('offTitle')}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-text-disabled">
          {denied ? t('deniedText') : on ? t('onText') : t('offText')}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-text-negative">
            {t('failed')}
          </p>
        )}
      </div>

      {!denied && (
        <Button
          variant={on ? 'surf2' : 'brand'}
          size="md"
          disabled={busy}
          onClick={() => void (on ? disable() : enable())}
          className="shrink-0 sm:min-w-[168px]"
        >
          {busy ? t('busy') : on ? t('turnOff') : t('turnOn')}
        </Button>
      )}
    </section>
  );
}
