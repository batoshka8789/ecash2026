'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { useGuestAddress } from '@/components/layout/AddressDropdown';
import { useAuth } from '@/lib/auth';
import { formatBranchAddress } from '@/lib/branch-address';
import { AddressModal } from './AddressModal';

const STORAGE_KEY = 'ecash.firstVisit.shown';

const listeners = new Set<() => void>();
let firstVisit: boolean | undefined;

/**
 * Первый визит живёт во внешнем сторе: сервер всегда рендерит «скрыто»
 * (нет расхождения гидратации), клиент один раз читает localStorage.
 * Закрытие пишет в localStorage — после перезагрузки тост не вернётся.
 */
const firstVisitStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    if (firstVisit === undefined) {
      try {
        firstVisit = window.localStorage.getItem(STORAGE_KEY) !== '1';
      } catch {
        // приватный режим — показываем, но не запоминаем
        firstVisit = true;
      }
    }
    return firstVisit;
  },
  dismiss() {
    firstVisit = false;
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  },
};

/**
 * Точка входа в выбор адреса на главной.
 *
 * При первом заходе — тост из макета (1279:104505) «Выберите адрес, найдём
 * ближайшие обменники»; факт показа запоминается. Дальше на его месте остаётся
 * постоянная плашка с текущим адресом: в шапке адресный контрол есть только
 * с md, а сменить адрес нужно в любой момент, а не единожды из тоста.
 * Оба контрола открывают одну модалку «modal window adress».
 */
export function FirstVisitToast() {
  const t = useTranslations('home.toast');
  const open = useSyncExternalStore(firstVisitStore.subscribe, firstVisitStore.get, () => false);
  const [modal, setModal] = useState(false);

  const { account, authed, loading } = useAuth();
  const guestAddress = useGuestAddress();
  const saved = (authed ? account?.profile.address : guestAddress) ?? '';

  // помечаем показ сразу — при следующей загрузке тост уже не появится
  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, [open]);

  return (
    <>
      {/* в макете тост стоит в 15px под шапкой (1279:104505 — y=98 при высоте шапки 83) */}
      <div role="status" className={clsx(open && 'pt-4')}>
        <Toast open={open} onClose={firstVisitStore.dismiss} closeLabel={t('close')} fixed={false}>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="cursor-pointer font-medium text-text-brand underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {t('link')}
          </button>
          {', '}
          {t('rest')}
        </Toast>
      </div>

      {/* Пока висит тост, второй CTA не нужен — плашка занимает его место после
          закрытия. Ждём загрузки сессии: иначе у пользователя с сохранённым
          адресом на миг мелькнёт «Укажите адрес». */}
      {!open && !loading && (
        <div className="container-page flex justify-center pt-6 sm:pt-8">
          <button
            type="button"
            onClick={() => setModal(true)}
            aria-haspopup="dialog"
            title={saved || undefined}
            className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-2xl bg-btn-1 px-3 py-2.5 transition-colors hover:bg-comp-surface2-hover"
          >
            <Icon
              name="location_on"
              size={20}
              filled={Boolean(saved)}
              className="shrink-0 text-text-brand"
            />
            {saved ? (
              <>
                {/* сырая строка Ecash в плашку не влезает — показываем короткий
                    вид, полный адрес остаётся в title */}
                <span className="truncate text-sm font-medium text-text-default">
                  {formatBranchAddress(saved)}
                </span>
                <span className="shrink-0 text-sm font-medium text-text-brand">{t('change')}</span>
              </>
            ) : (
              <span className="text-sm font-medium text-text-brand">{t('cta')}</span>
            )}
          </button>
        </div>
      )}

      <AddressModal open={modal} onClose={() => setModal(false)} />
    </>
  );
}
