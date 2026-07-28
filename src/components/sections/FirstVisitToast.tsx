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
      {/*
       * Зазор под шапкой — константа макета: контентная колонка начинается со
       * 105 на 360/480 (шапка 73 + 32) и со 183 на ≥768 (шапка 83 + 100),
       * независимо от того, показан тост или нет. Поэтому зазор держит ЭТОТ
       * блок, а не отступ ленты карточек: тост лежит поверх него и высоты не
       * занимает, а плашка адреса живёт внутри. Иначе после закрытия тоста
       * плашка вставала в поток поверх зазора и сдвигала всё вниз на 72px.
       *
       * Плашки адреса в макете нет ни на одном экране, и ниже 768 она в 32px
       * не помещается — там она добавляет свою высоту; на ≥768 укладывается
       * в те же 100.
       */}
      <div
        className={clsx(
          'relative',
          open || loading ? 'h-8 md:h-25' : 'pt-6 sm:pt-8 md:flex md:h-25 md:items-center md:pt-0',
        )}
      >
        {open && (
          /*
           * Отступ от низа шапки макет задаёт разный: 7 на 360/480 (тост y=80
           * при шапке 73), 25 на 768 и 1024 (y=108 при шапке 83) и 15 на 1920
           * (y=98) — расхождение внутри самого макета при одинаковой шапке.
           *
           * pointer-events-none: оверлей растянут на всю ширину и ниже 768
           * накрывает верхнюю кромку плиток — без этого по ним не кликнуть.
           */
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[7px] md:pt-[25px] xl:pt-[15px]">
            <Toast
              open={open}
              onClose={firstVisitStore.dismiss}
              closeLabel={t('close')}
              fixed={false}
              className="pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => setModal(true)}
                // начертание наследуем от подписи тоста: ниже 768 макет даёт Regular
                className="cursor-pointer text-text-brand underline underline-offset-2 transition-opacity hover:opacity-80 md:font-medium"
              >
                {t('link')}
              </button>
              {', '}
              {t('rest')}
            </Toast>
          </div>
        )}

        {/* Пока висит тост, второй CTA не нужен — плашка занимает его место после
            закрытия. Ждём загрузки сессии: иначе у пользователя с сохранённым
            адресом на миг мелькнёт «Укажите адрес». */}
        {!open && !loading && (
          <div className="container-page flex w-full justify-center">
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
                  <span className="shrink-0 text-sm font-medium text-text-brand">
                    {t('change')}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-text-brand">{t('cta')}</span>
              )}
            </button>
          </div>
        )}
      </div>

      <AddressModal open={modal} onClose={() => setModal(false)} />
    </>
  );
}
