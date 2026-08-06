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
import { useAdminStrings } from './strings';
import { formatDateTime } from '@/lib/format';
import { plainTextFromStoredBody } from '@/lib/richtext-doc';
import type { Locale, NewsAdminPost, NewsStatus } from '@/lib/domain';

const LOCALES: Locale[] = ['ru', 'en', 'kk', 'zh'];
const LOCALE_LABEL: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз', zh: '中文' };

type Filter = 'all' | NewsStatus;

/** Библиотека: все материалы и черновики со статусом и заполненными языками. */
export function NewsLibrary() {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useAdminStrings();
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
      setToast(post.status === 'published' ? t.unpublished : t.published);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.admin.news.remove(id),
    onSuccess: () => {
      invalidate();
      setConfirmId(null);
      setToast(t.removed);
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

  const counts = useMemo(() => {
    const all = data?.posts ?? [];
    return {
      all: all.length,
      published: all.filter((p) => p.status === 'published').length,
      draft: all.filter((p) => p.status === 'draft').length,
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-5">
      <Toast open={Boolean(toast)} tone="positive" onClose={() => setToast(null)} closeLabel={t.close}>
        {toast}
      </Toast>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-default sm:text-2xl">{t.libraryTitle}</h1>
          <p className="mt-1 text-sm text-text-disabled">
            {data
              ? t.summary(counts.all, counts.published, counts.draft)
              : t.loading}
          </p>
        </div>
        <Button onClick={() => router.push('/admin/news/new')}>{t.create}</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-transparent bg-surface-page-surf2 px-4 transition-colors focus-within:border-stroke-brand">
          <Icon name="search" size={20} className="shrink-0 text-text-disabled" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            className="w-full bg-transparent text-sm text-text-default outline-none placeholder:text-text-disabled"
          />
        </div>
        <PillTabs
          className="shrink-0"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all' as Filter, label: t.filterAll },
            { value: 'draft' as Filter, label: t.filterDrafts },
            { value: 'published' as Filter, label: t.filterPublished },
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
          <p className="text-text-disabled">{t.loadFailed}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            {t.retry}
          </Button>
        </div>
      )}

      {data && posts.length === 0 && (
        <div className="rounded-2xl bg-surface-page-surf1 p-10 text-center">
          <Icon name="newspaper" size={40} className="text-text-disabled" />
          <p className="mt-3 text-text-default">
            {data.posts.length === 0 ? t.emptyAll : t.emptyFound}
          </p>
          {data.posts.length === 0 && (
            <Button className="mt-4" onClick={() => router.push('/admin/news/new')}>
              {t.createFirst}
            </Button>
          )}
        </div>
      )}

      {posts.map((post) => {
        const ru = post.translations.ru;
        const title = ru?.title || Object.values(post.translations)[0]?.title || t.noTitle;
        const summary =
          ru?.excerpt || plainTextFromStoredBody(ru?.body ?? '', 160) || t.noText;
        const published = post.status === 'published';
        return (
          <div
            key={post.id}
            className="flex flex-col gap-4 rounded-2xl bg-surface-page-surf1 p-4 transition-colors hover:bg-comp-surface1-hover sm:flex-row sm:items-center"
          >
            <Link
              href={`/admin/news/${post.id}`}
              aria-label={t.open(title)}
              className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-surface-page-surf2 sm:h-20 sm:w-32"
            >
              {post.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image}
                  alt=""
                  style={{ objectPosition: post.imageFocus }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-text-disabled">
                  <Icon name="image" size={20} />
                </span>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    published
                      ? 'bg-positive text-text-always-white'
                      : 'bg-surface-page-surf2 text-text-disabled',
                  )}
                >
                  {published ? t.statusPublished : t.statusDraft}
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
                  {t.languages}:{' '}
                  {LOCALES.filter((l) => post.translations[l])
                    .map((l) => LOCALE_LABEL[l])
                    .join(', ') || t.languagesNone}
                </span>
                <span className="text-xs text-text-disabled">
                  {formatDateTime(post.updatedAt, 'ru')}
                </span>
              </div>

              <Link
                href={`/admin/news/${post.id}`}
                className="mt-1.5 block truncate text-base font-semibold text-text-default hover:text-text-brand"
              >
                {title}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-sm text-text-disabled">{summary}</p>
              <p className="mt-1 truncate text-xs text-text-disabled">/news/{post.slug}</p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {published && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.openOnSite}
                  title={t.openOnSite}
                  onClick={() => window.open(`/news/${post.slug}`, '_blank', 'noopener')}
                >
                  <Icon name="open_in_new" size={20} />
                </Button>
              )}
              <Button
                variant="surf2"
                size="md"
                disabled={pending}
                onClick={() => toggle.mutate(post)}
              >
                {published ? t.unpublish : t.publish}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.remove}
                title={t.remove}
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
            aria-label={t.close}
            className="absolute inset-0 cursor-default bg-scrim"
            onClick={() => setConfirmId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.removeTitle}
            className="relative w-full max-w-sm rounded-3xl bg-surface-modal-bg p-6"
          >
            <h2 className="text-lg font-bold text-text-default">{t.removeTitle}</h2>
            <p className="mt-2 text-sm text-text-disabled">
              {t.removeWarning}
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="surf2" className="flex-1" onClick={() => setConfirmId(null)}>
                {t.cancel}
              </Button>
              <Button
                className="flex-1"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmId)}
              >
                {t.remove}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

