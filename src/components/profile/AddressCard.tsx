'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';

/** Вкладка «Мой адрес»: поле адреса + карта, сохранение через мок-бэкенд. */
export function AddressCard() {
  const t = useTranslations('profile.address');
  const { user, setUser } = useAuth();
  const save = useMutation(api.profile.save);
  const errorText = useErrorText();

  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(false);

  // синхронизация из сессии во время рендера
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (user && syncedFor !== user.id) {
    setSyncedFor(user.id);
    setAddress(user.address);
  }

  const submit = async () => {
    const res = await save.run({ address });
    if (res) {
      setUser(res.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('title')}</h2>
      <p className="mt-1 text-sm text-text-disabled">{t('subtitle')}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center rounded-2xl border border-stroke-modal transition-colors focus-within:border-stroke-surface3">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('placeholder')}
            className="h-12 w-full bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled"
          />
          {address && (
            <button
              type="button"
              onClick={() => setAddress('')}
              aria-label={t('clear')}
              className="cursor-pointer px-3 text-text-disabled transition-colors hover:text-text-default"
            >
              <Icon name="cancel" size={20} />
            </button>
          )}
        </div>
        <Button onClick={submit} disabled={save.busy} className="sm:w-40">
          {saved ? t('saved') : t('save')}
        </Button>
      </div>

      {save.error && <p className="mt-3 text-sm text-text-negative">{errorText(save.error)}</p>}

      <div className="mt-5 overflow-hidden rounded-2xl">
        <img
          src="/img/map-address.png"
          alt={t('mapAlt')}
          className="h-64 w-full object-cover sm:h-72"
        />
      </div>
    </div>
  );
}
