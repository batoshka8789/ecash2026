'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PillTabs } from '@/components/ui/PillTabs';
import { Toast } from '@/components/ui/Toast';
import { RichText } from '@/components/ui/RichText';
import { NewsCard } from '@/components/news/NewsCard';
import { RichTextArea } from './RichTextArea';
import { ImageDrop } from './ImageDrop';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';
import { richTextToPlain } from '@/lib/richtext';
import type { Locale, NewsTranslation, NewsTranslations } from '@/lib/domain';

const LOCALES: Locale[] = ['ru', 'en', 'kk', 'zh'];
const LOCALE_LABEL: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз', zh: '中文' };

const empty = (): NewsTranslation => ({ title: '', excerpt: '', body: '' });

/**
 * Редактор новости. Обязателен только русский — остальные языки можно
 * дописать позже, без перевода посетителю покажется русская версия.
 *
 * Кнопки везде type="button" и сохранение вызывается вручную: если менять
 * type на submit внутри собственного onClick, браузер отправит форму
 * действием по умолчанию того же клика (этот баг здесь уже ловили).
 */
export function NewsEditor({ id }: { id?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const errorText = useErrorText();

  const [locale, setLocale] = useState<Locale>('ru');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [tr, setTr] = useState<NewsTranslations>({ ru: empty() });
  const [image, setImage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['admin', 'news', id],
    queryFn: ({ signal }) => api.admin.news.get(id!, signal),
    enabled: Boolean(id),
  });

  // подтягиваем существующую новость один раз, когда она загрузилась
  const loaded = existing.data?.post;
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (loaded && syncedFor !== loaded.id) {
    setSyncedFor(loaded.id);
    setTr(loaded.translations.ru ? loaded.translations : { ...loaded.translations, ru: empty() });
    setImage(loaded.image || null);
    setSlug(loaded.slug);
  }

  // предупреждение о несохранённых правках при закрытии вкладки
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const current = tr[locale] ?? empty();
  const setField = (field: keyof NewsTranslation, value: string) => {
    setDirty(true);
    setTr((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? empty()), [field]: value } }));
  };

  /** Пустые переводы не отправляем — иначе язык будет числиться заполненным. */
  const payloadTranslations = useMemo(() => {
    const out: NewsTranslations = {};
    for (const l of LOCALES) {
      const t = tr[l];
      if (t?.title.trim()) out[l] = t;
    }
    return out;
  }, [tr]);

  const ruReady = Boolean(tr.ru?.title.trim() && tr.ru?.body.trim());

  const save = useMutation({
    mutationFn: async (status?: 'draft' | 'published') => {
      const payload = {
        translations: payloadTranslations,
        image: image ?? '',
        ...(slug ? { slug } : {}),
        ...(status ? { status } : {}),
      };
      return id
        ? api.admin.news.update(id, payload)
        : api.admin.news.create(payload as Parameters<typeof api.admin.news.create>[0]);
    },
    onSuccess: (res, status) => {
      setDirty(false);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
      void qc.invalidateQueries({ queryKey: ['news'] });
      setToast(status === 'published' ? 'Опубликовано' : 'Сохранено');
      if (!id) router.replace(`/admin/news/${res.post.id}`);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? errorText(e.message) : errorText('errors.unknown'));
    },
  });

  const submit = (status?: 'draft' | 'published') => {
    if (!tr.ru?.title.trim()) {
      setLocale('ru');
      setError(errorText('errors.titleRequired'));
      return;
    }
    if (status === 'published' && !ruReady) {
      setLocale('ru');
      setError(errorText('errors.newsRuRequired'));
      return;
    }
    setError(null);
    save.mutate(status);
  };

  const previewExcerpt = current.excerpt || richTextToPlain(current.body, 220);

  const editor = (
    <div className="flex flex-col gap-4">
      <PillTabs
        value={locale}
        onChange={setLocale}
        tabs={LOCALES.map((l) => ({
          value: l,
          label: `${LOCALE_LABEL[l]}${tr[l]?.title.trim() ? ' •' : ''}`,
        }))}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-disabled">
          Заголовок{locale === 'ru' && <span className="text-text-brand"> *</span>}
        </span>
        <input
          value={current.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="Например: Новые условия обмена"
          className="h-14 rounded-2xl border border-transparent bg-surface-page-surf2 px-4 text-base text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:text-text-disabled"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-disabled">Обложка</span>
        <ImageDrop
          value={image}
          onChange={(url) => {
            setDirty(true);
            setImage(url);
          }}
          onLocalPreview={setLocalPreview}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-disabled">
          Анонс для ленты <span className="text-xs">(не обязательно — возьмём начало текста)</span>
        </span>
        <textarea
          value={current.excerpt}
          onChange={(e) => setField('excerpt', e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="Короткая выжимка"
          className="resize-none rounded-2xl border border-transparent bg-surface-page-surf2 px-4 py-3 text-sm text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:text-text-disabled"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-disabled">
          Текст{locale === 'ru' && <span className="text-text-brand"> *</span>}
        </span>
        <RichTextArea
          value={current.body}
          onChange={(v) => setField('body', v)}
          placeholder="Текст новости. Выделите слово и нажмите Ж или К."
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-disabled">
          Адрес страницы <span className="text-xs">(пусто — создадим из заголовка)</span>
        </span>
        <input
          value={slug}
          onChange={(e) => {
            setDirty(true);
            setSlug(e.target.value);
          }}
          placeholder="novye-usloviya"
          className="h-12 rounded-2xl border border-transparent bg-surface-page-surf2 px-4 text-sm text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:text-text-disabled"
        />
      </label>
    </div>
  );

  const preview = (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-disabled">Так новость увидит посетитель</p>
      <NewsCard
        image={image}
        localImage={localPreview}
        title={current.title || 'Заголовок новости'}
        excerpt={previewExcerpt}
      />
      <div className="rounded-2xl bg-surface-page-surf1 p-4 sm:p-6">
        <h3 className="text-base font-bold text-text-default">Страница новости</h3>
        <RichText source={current.body} className="mt-2" />
        {!current.body.trim() && (
          <p className="mt-2 text-sm text-text-disabled">Текста пока нет</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Toast open={Boolean(toast)} tone="positive" onClose={() => setToast(null)} closeLabel="Закрыть">
        {toast}
      </Toast>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/news')}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-disabled transition-colors hover:text-text-default"
        >
          <Icon name="arrow_back" size={18} />
          К списку
        </button>

        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-text-disabled">Есть несохранённые правки</span>}
          <Button variant="surf2" disabled={save.isPending} onClick={() => submit()}>
            Сохранить
          </Button>
          <Button
            disabled={save.isPending || !ruReady}
            title={ruReady ? undefined : 'Для публикации заполните русский заголовок и текст'}
            onClick={() => submit('published')}
          >
            Опубликовать
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-negative-hardsoft px-4 py-3 text-sm text-text-negative">
          {error}
        </p>
      )}

      {/* мобильный: вкладки, чтобы редактор и превью не сжимали друг друга */}
      <div className="xl:hidden">
        <PillTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'edit' as const, label: 'Редактор' },
            { value: 'preview' as const, label: 'Превью' },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className={clsx(tab === 'edit' ? 'block' : 'hidden', 'xl:block')}>{editor}</div>
        <div className={clsx(tab === 'preview' ? 'block' : 'hidden', 'xl:block')}>
          <div className="xl:sticky xl:top-24">{preview}</div>
        </div>
      </div>
    </div>
  );
}
