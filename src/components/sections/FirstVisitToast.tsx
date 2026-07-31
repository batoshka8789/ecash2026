'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { useGuestAddress } from '@/components/layout/AddressDropdown';
import { useAuth } from '@/lib/auth';
import { formatBranchAddress } from '@/lib/branch-address';
import { AddressModal } from './AddressModal';

/**
 * Точка входа в выбор адреса на главной — постоянная плашка по центру над
 * карточками действий: «Укажите адрес», а с сохранённым адресом — адрес и
 * «Изменить». Оба состояния открывают одну модалку «modal window adress».
 *
 * Раньше при первом визите вместо плашки показывался широкий тост-баннер
 * (макет 1279:104505), и кнопка «переезжала»: заказчик воспринял это как
 * «кнопка выбора адреса пропала». Тост убран — контрол всегда один и всегда
 * на одном месте, ровно как на скриншоте главной в замечаниях.
 *
 * Пока сессия грузится, плашку не прячем (иначе она «мигает»), но и адрес
 * не показываем — у пользователя с сохранённым адресом короткий миг видна
 * нейтральная надпись, это лучше скачущей вёрстки.
 */
export function FirstVisitToast() {
  const t = useTranslations('home.toast');
  const [modal, setModal] = useState(false);

  const { account, authed } = useAuth();
  const guestAddress = useGuestAddress();
  const saved = (authed ? account?.profile.address : guestAddress) ?? '';

  return (
    <>
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

      <AddressModal open={modal} onClose={() => setModal(false)} />
    </>
  );
}
