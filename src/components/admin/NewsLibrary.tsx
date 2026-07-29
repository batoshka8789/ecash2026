'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PillTabs } from '@/components/ui/PillTabs';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Locale, NewsAdminPost, NewsStatus } from '@/lib/domain';

const LOCALES: Locale[] = ['ru', 'en', 'kk', 'zh'];
const LOCALE_LABEL: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз', zh: '中文' };

type Filter = 'all' | NewsStatus;

/** Библиотека: все материалы и черновики со статусом и заполненными языками. */
export function NewsLibrary() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'news'],
    queryFn: ({ signal }) => api.admin.news.list({}, signal),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
    void qc.invalidateQueries({ queryKey: ['news'] });
  };

  const toggle = useMutation({
    mutationFn: (post: NewsAdminPost) =>
      api.admin.news.update(post.id, {
        status: post.status === 'published' ? 'draft' : 'published',
      }),
    onSuccess: (_r, post) => {
      invalidate();
      setToast(post.status === 'published' ? 'Снято с публикации' : 'Опубликовано');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.admin.news.remove(id),
    onSuccess: () => {
      invalidate();
      setConfirmId(null);
      setToast('Новость удалена');
    },
  });

  const posts = useMemo(() => {
    const all = data?.posts ?? [];
    const needle = query.trim().toLowerCase();
    return all
      .filter((p) => filter === 'all' || p.status === filter)
      .filter(
        (p) =>
          !needle ||
          p.slug.includes(needle) ||
          Object.values(p.translations).some((t) => t?.title.toLowerCase().includes(needle)),
      );
  }, [data, filter, query]);

  const pending = toggle.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Toast open={Boolean(toast)} tone="positive" onClose={() => setToast(null)} closeLabel="Закрыть">
        {toast}
      </Toast>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-default sm:text-2xl">Новости</h1>
        <Button onClick={() => router.push('/admin/news/new')}>Создать новость</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-transparent bg-surface-page-surf2 px-4 transition-colors focus-within:border-stroke-brand">
          <Icon name="search" size={20} className="shrink-0 text-text-disabled" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по заголовку или адресу"
            aria-label="Поиск по новостям"
            className="w-full bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled"
          />
        </div>
        <PillTabs
          className="shrink-0"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all' as Filter, label: 'Все' },
            { value: 'draft' as Filter, label: 'Черновики' },
            { value: 'published' as Filter, label: 'Опубликованы' },
          ]}
        />
      </div>

      {isPending && (
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-page-surf1" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl bg-surface-page-surf1 p-6 text-center">
          <p className="text-text-disabled">Не удалось загрузить список</p>
          <Button className="mt-4" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      )}

      {data && posts.length === 0 && (
        <div className="rounded-2xl bg-surface-page-surf1 p-10 text-center">
          <Icon name="newspaper" size={40} className="text-text-disabled" />
          <p className="mt-3 text-text-default">
            {data.posts.length === 0 ? 'Пока ни одной новости' : 'Ничего не найдено'}
          </p>
          {data.posts.length === 0 && (
            <Button className="mt-4" onClick={() => router.push('/admin/news/new')}>
              Создать первую
            </Button>
          )}
        </div>
      )}

      {posts.map((post) => {
        const title = post.translations.ru?.title || Object.values(post.translations)[0]?.title || '(без заголовка)';
        return (
          <div
            key={post.id}
            className="flex flex-col gap-3 rounded-2xl bg-surface-page-surf1 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-page-surf2">
              {post.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-disabled">
                  <Icon name="image" size={20} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/news/${post.id}`}
                className="block truncate font-medium text-text-default hover:text-text-brand"
              >
                {title}
              </Link>
              <p className="truncate text-xs text-text-disabled">/{post.slug}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    post.status === 'published'
                      ? 'bg-positive text-text-always-white'
                      : 'bg-surface-page-surf2 text-text-disabled',
                  )}
                >
                  {post.status === 'published' ? 'Опубликовано' : 'Черновик'}
                </span>
                <span aria-hidden className="flex gap-1">
                  {LOCALES.map((l) => (
                    <span
                      key={l}
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[11px]',
                        post.translations[l]
                          ? 'bg-brand-hardsoft text-text-brand'
                          : 'text-text-disabled',
                      )}
                    >
                      {post.translations[l] ? LOCALE_LABEL[l] : '—'}
                    </span>
                  ))}
                </span>
                <span className="sr-only">
                  Языки: {LOCALES.filter((l) => post.translations[l]).map((l) => LOCALE_LABEL[l]).join(', ') || 'нет'}
                </span>
                <span className="text-xs text-text-disabled">
                  {formatDateTime(post.updatedAt, 'ru')}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="surf2"
                size="md"
                disabled={pending}
                onClick={() => toggle.mutate(post)}
              >
                {post.status === 'published' ? 'Снять' : 'Опубликовать'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Удалить"
                title="Удалить"
                disabled={pending}
                className="text-text-negative"
                onClick={() => setConfirmId(post.id)}
              >
                <Icon name="delete" size={20} />
              </Button>
            </div>
          </div>
        );
      })}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* подложка — кнопка: клик закрывает, но при этом остаётся доступной
              с клавиатуры и не считается «немым» элементом с обработчиком */}
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 cursor-default bg-scrim"
            onClick={() => setConfirmId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Удалить новость"
            className="relative w-full max-w-sm rounded-3xl bg-surface-modal-bg p-6"
          >
            <h2 className="text-lg font-bold text-text-default">Удалить новость?</h2>
            <p className="mt-2 text-sm text-text-disabled">
              Отменить это действие будет нельзя.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="surf2" className="flex-1" onClick={() => setConfirmId(null)}>
                Отмена
              </Button>
              <Button
                className="flex-1"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmId)}
              >
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
