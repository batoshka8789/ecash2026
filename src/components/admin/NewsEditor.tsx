'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PillTabs } from '@/components/ui/PillTabs';
import { Toast } from '@/components/ui/Toast';
import { RichText } from '@/components/ui/RichText';
import { NewsCard } from '@/components/news/NewsCard';
import { RichTextEditor } from './RichTextEditor';
import { ImageDrop } from './ImageDrop';
import { DeviceFrame, type Device } from './DeviceFrame';
import { useAdminStrings } from './strings';
import { api, ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/useErrorText';
import { isBodyEmpty, plainTextFromStoredBody, richExcerptOf } from '@/lib/richtext-doc';
import { slugify } from '@/lib/slug';
import {
  DEFAULT_IMAGE_FOCUS,
  type ImageFocus,
  type Locale,
  type NewsTranslation,
  type NewsTranslations,
} from '@/lib/domain';

const LOCALES: Locale[] = ['ru', 'en', 'kk', 'zh'];
const LOCALE_LABEL: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз', zh: '中文' };
const TITLE_LIMIT = 200;

const empty = (): NewsTranslation => ({ title: '', excerpt: '', body: '' });

/** Пустые переводы не отправляем — иначе язык будет числиться заполненным. */
function nonEmptyTranslations(tr: NewsTranslations): NewsTranslations {
  const out: NewsTranslations = {};
  for (const l of LOCALES) {
    const v = tr[l];
    if (v?.title.trim()) out[l] = v;
  }
  return out;
}

/** Секция формы: заголовок с иконкой + содержимое. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-surface-page-surf1 p-4 sm:p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <Icon name={icon} size={20} className="translate-y-1 text-text-brand" />
        <h2 className="text-sm font-semibold text-text-default">{title}</h2>
        {hint && <span className="text-xs text-text-disabled">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Редактор новости. Обязателен только русский — остальные языки можно
 * дописать позже, без перевода посетителю покажется русская версия.
 *
 * Кнопки везде type="button" и сохранение вызывается вручную: если менять
 * type на submit внутри собственного onClick, браузер отправит форму
 * действием по умолчанию того же клика (этот баг здесь уже ловили).
 */
/**
 * Домен для показа адреса статьи в редакции — из NEXT_PUBLIC_SITE_URL.
 * Раньше здесь было зашито «ecash.kz»: на чужом развёртывании админ видел
 * бы в предпросмотре чужой домен вместо своего.
 */
const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecash.kz')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

export function NewsEditor({ id }: { id?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const t = useAdminStrings();

  const [locale, setLocale] = useState<Locale>('ru');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [screen, setScreen] = useState<'feed' | 'page'>('page');
  const [tr, setTr] = useState<NewsTranslations>({ ru: empty() });
  const [image, setImage] = useState<string | null>(null);
  const [imageFocus, setImageFocus] = useState<ImageFocus>(DEFAULT_IMAGE_FOCUS);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [dirty, setDirty] = useState(false);
  /**
   * Какие локали редактор РЕАЛЬНО трогал. При сохранении отправляются только
   * они: серверный автоперевод дописывает en/kk/zh в БД в фоне, и если слать
   * все локали из состояния редактора (загруженного раньше), устаревшая
   * копия затирала бы свежие переводы и намертво помечала их «ручными».
   */
  const [dirtyLocales, setDirtyLocales] = useState<Set<Locale>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

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
    setImageFocus(loaded.imageFocus);
    setSlug(loaded.slug);
    setDirtyLocales(new Set());
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
    setDirtyLocales((prev) => new Set(prev).add(locale));
    setTr((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? empty()), [field]: value } }));
  };

  const ruReady = Boolean(tr.ru?.title.trim() && tr.ru?.body && !isBodyEmpty(tr.ru.body));
  // тем же правилом адрес выведет сервер, если поле оставить пустым
  const effectiveSlug = slug || slugify(tr.ru?.title ?? '') || 'novost';

  /**
   * Автоматически заполняет ТОЛЬКО пустые локали переводом с русского —
   * заполненные (в том числе вручную поправленные) не трогает, поэтому
   * безопасно звать и на каждое сохранение, и по кнопке «Перевести». Тост
   * сюда не входит: при автопереводе на сохранении его почти сразу перекрыл
   * бы тост «Сохранено», а вкладки с точками и так покажут результат.
   *
   * Возвращает переводы напрямую (не через состояние): mutationFn ниже не
   * может полагаться на tr из замыкания — setTr к этому моменту ещё не
   * долетит до реального значения при повторном вызове в том же тике.
   */
  const runAutoTranslate = async (
    base: NewsTranslations,
  ): Promise<{ tr: NewsTranslations; done: Locale[] }> => {
    const missing = LOCALES.filter((l) => l !== 'ru' && !base[l]?.title.trim());
    if (!base.ru?.title.trim() || !base.ru?.body || isBodyEmpty(base.ru.body) || !missing.length) {
      return { tr: base, done: [] };
    }
    try {
      const res = await api.admin.translate({ from: 'ru', to: missing, fields: base.ru });
      const done = Object.keys(res.translations) as Locale[];
      if (!done.length) return { tr: base, done: [] };
      const merged = { ...base, ...res.translations };
      setTr(merged);
      setDirty(true);
      // переводы, вызванные кнопкой, редактор явно кураторствует — они
      // сохраняются (и становятся «ручными» для серверного автоперевода)
      setDirtyLocales((prev) => {
        const next = new Set(prev);
        for (const l of done) next.add(l);
        return next;
      });
      return { tr: merged, done };
    } catch {
      return { tr: base, done: [] }; // перевод — необязательный шаг, не должен блокировать сохранение
    }
  };

  const translateNow = async () => {
    if (!ruReady || translating) return;
    setTranslating(true);
    try {
      const { done } = await runAutoTranslate(tr);
      if (done.length) setToast(t.translated(done.map((l) => t.languageName[l]).join(', ')));
    } finally {
      setTranslating(false);
    }
  };

  const save = useMutation({
    mutationFn: async (status?: 'draft' | 'published') => {
      // Автоперевод на сохранении переехал НА СЕРВЕР (news-autotranslate):
      // он сам дописывает недостающие языки в фоне и, в отличие от прежнего
      // клиентского вызова, помечает их авто-метками — русский изменился,
      // переводы обновятся. Кнопка «Перевести» осталась для случая, когда
      // редактору нужно увидеть и поправить перевод прямо сейчас.
      if (!id) {
        // создание: сервер требует русский — новая запись отправляется целиком
        const payload = {
          translations: nonEmptyTranslations(tr),
          image: image ?? '',
          imageFocus,
          ...(slug ? { slug } : {}),
          ...(status ? { status } : {}),
        };
        return api.admin.news.create(payload as Parameters<typeof api.admin.news.create>[0]);
      }
      // правка: отправляются ТОЛЬКО тронутые локали (см. dirtyLocales)
      const touched: NewsTranslations = {};
      for (const l of dirtyLocales) {
        const value = tr[l];
        if (value?.title.trim()) touched[l] = value;
      }
      const payload = {
        ...(Object.keys(touched).length ? { translations: touched } : {}),
        image: image ?? '',
        imageFocus,
        ...(slug ? { slug } : {}),
        ...(status ? { status } : {}),
      };
      return api.admin.news.update(id, payload);
    },
    onSuccess: (res, status) => {
      setDirty(false);
      setDirtyLocales(new Set());
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
      void qc.invalidateQueries({ queryKey: ['news'] });
      setToast(status === 'published' ? t.published : t.saved);
      if (!id) router.replace(`/admin/news/${res.post.id}`);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? errorText(e) : errorText('errors.unknown'));
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

  const previewTitle = current.title || t.previewTitle;
  const previewExcerpt = current.excerpt || plainTextFromStoredBody(current.body, 220);
  /**
   * Тем же правилом, что и сервер (toPublicPost): пустой анонс — показываем
   * начало статьи с оформлением. Иначе превью ленты в админке разошлось бы
   * с сайтом ровно в том месте, ради которого превью и существует.
   */
  const previewExcerptRich = current.excerpt ? undefined : (richExcerptOf(current.body) ?? undefined);
  const titleLeft = TITLE_LIMIT - current.title.length;

  const editor = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PillTabs
          value={locale}
          onChange={setLocale}
          tabs={LOCALES.map((l) => ({
            value: l,
            label: `${LOCALE_LABEL[l]}${tr[l]?.title.trim() ? ' •' : ''}`,
          }))}
        />
        <button
          type="button"
          onClick={() => void translateNow()}
          disabled={!ruReady || translating}
          title={ruReady ? t.translateNote : t.translateNeedsRu}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-text-brand transition-colors hover:bg-brand-hardsoft disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent"
        >
          <Icon
            name={translating ? 'progress_activity' : 'translate'}
            size={16}
            className={translating ? 'animate-spin' : undefined}
          />
          {translating ? t.translating : t.translate}
        </button>
      </div>

      <Section
        icon="title"
        title={t.fieldTitle}
        hint={locale === 'ru' ? t.required : t.fallbackHint}
      >
        <input
          value={current.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder={t.titlePlaceholder}
          className="h-14 w-full rounded-2xl border border-transparent bg-surface-page-surf2 px-4 text-base font-medium text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:font-normal placeholder:text-text-disabled"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-text-disabled">
          <span>{t.titleHint}</span>
          <span className={clsx(titleLeft < 0 && 'text-text-negative')}>
            {current.title.length} / {TITLE_LIMIT}
          </span>
        </div>
      </Section>

      <Section icon="image" title={t.fieldCover} hint={t.coverHint}>
        <ImageDrop
          value={image}
          onChange={(url) => {
            setDirty(true);
            setImage(url);
          }}
          onLocalPreview={setLocalPreview}
          focus={imageFocus}
          onFocusChange={(f) => {
            setDirty(true);
            setImageFocus(f);
          }}
        />
      </Section>

      <Section icon="short_text" title={t.fieldExcerpt} hint={t.excerptHint}>
        <textarea
          value={current.excerpt}
          onChange={(e) => setField('excerpt', e.target.value)}
          rows={2}
          maxLength={400}
          placeholder={t.excerptPlaceholder}
          className="w-full resize-none rounded-2xl border border-transparent bg-surface-page-surf2 px-4 py-3 text-sm text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:text-text-disabled"
        />
      </Section>

      <Section
        icon="article"
        title={t.fieldBody}
        hint={locale === 'ru' ? t.required : undefined}
      >
        <RichTextEditor
          // Tiptap читает value только при создании редактора — remount нужен
          // не только при смене вкладки локали, но и один раз, когда данные
          // существующей новости долетают асинхронно (locale тогда не
          // меняется, и без id в ключе редактор навсегда остался бы пустым).
          key={`${locale}-${syncedFor ?? 'new'}`}
          value={current.body}
          onChange={(v) => setField('body', v)}
          placeholder={t.bodyPlaceholder}
        />
      </Section>

      <Section icon="link" title={t.fieldSlug} hint={t.slugHint}>
        <input
          value={slug}
          onChange={(e) => {
            setDirty(true);
            setSlug(e.target.value);
          }}
          placeholder={slugify(tr.ru?.title ?? '') || 'novye-usloviya'}
          className="h-12 w-full rounded-2xl border border-transparent bg-surface-page-surf2 px-4 text-sm text-text-default outline-none transition-colors focus:border-stroke-brand placeholder:text-text-disabled"
        />
        <p className="mt-2 truncate text-xs text-text-disabled">
          {SITE_HOST}/news/<span className="text-text-brand">{effectiveSlug}</span>
        </p>
      </Section>
    </div>
  );

  /** Лента: та же карточка, что на сайте. */
  const feedScreen = (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-[1232px]">
        <NewsCard
          image={image}
          imageFocus={imageFocus}
          localImage={localPreview}
          title={previewTitle}
          excerpt={previewExcerpt}
          excerptRich={previewExcerptRich}
        />
      </div>
    </div>
  );

  /** Страница новости: повторяет разметку публичной страницы. */
  const pageScreen = (
    <div className="px-4 py-6">
      <article className="mx-auto flex max-w-3xl flex-col">
        <span className="inline-flex w-fit items-center gap-2 text-sm text-text-disabled">
          <Icon name="arrow_back" size={18} />
          {t.previewAllNews}
        </span>

        {(localPreview ?? image) && (
          <div className="mt-5 h-56 w-full overflow-hidden rounded-2xl bg-surface-page-surf2 sm:h-80 sm:rounded-3xl">
            {/* обычный img: оптимизатор Next не берёт blob-адреса */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(localPreview ?? image)!}
              alt=""
              style={{ objectPosition: imageFocus }}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <h1 className="mt-6 text-2xl font-bold text-text-default sm:text-[32px]">{previewTitle}</h1>
        <span className="mt-2 text-sm text-text-disabled">{t.previewToday}</span>

        <RichText source={current.body} className="mt-4 pb-6" />
        {isBodyEmpty(current.body) && (
          <p className="mt-4 text-sm text-text-disabled">{t.noText}</p>
        )}
      </article>
    </div>
  );

  const preview = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PillTabs
          variant="r20"
          value={screen}
          onChange={setScreen}
          tabs={[
            { value: 'page' as const, label: t.screenPage },
            { value: 'feed' as const, label: t.screenFeed },
          ]}
        />
        <div
          role="radiogroup"
          aria-label={t.screenSize}
          className="flex gap-1 rounded-3xl bg-surface-page-bg p-1"
        >
          {(
            [
              { v: 'desktop' as Device, icon: 'computer', label: t.deviceDesktop },
              { v: 'mobile' as Device, icon: 'smartphone', label: t.deviceMobile },
            ]
          ).map((d) => (
            <button
              key={d.v}
              type="button"
              role="radio"
              aria-checked={device === d.v}
              aria-label={d.label}
              title={d.label}
              onClick={() => setDevice(d.v)}
              className={clsx(
                'inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-[18px] transition-colors',
                device === d.v
                  ? 'bg-surface-page-surf1 text-text-brand'
                  : 'text-text-default hover:text-text-brand',
              )}
            >
              <Icon name={d.icon} size={20} />
            </button>
          ))}
        </div>
      </div>

      <DeviceFrame
        device={device}
        url={screen === 'feed' ? `${SITE_HOST}/news` : `${SITE_HOST}/news/${effectiveSlug}`}
      >
        {screen === 'feed' ? feedScreen : pageScreen}
      </DeviceFrame>

      <p className="text-xs text-text-disabled">
        {t.previewNote(device === 'mobile' ? 390 : 1280)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Toast open={Boolean(toast)} tone="positive" onClose={() => setToast(null)} closeLabel={t.close}>
        {toast}
      </Toast>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/news')}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-disabled transition-colors hover:text-text-default"
        >
          <Icon name="arrow_back" size={18} />
          {t.backToList}
        </button>

        <div className="flex items-center gap-2">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-disabled">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t.unsaved}
            </span>
          )}
          <Button variant="surf2" disabled={save.isPending} onClick={() => submit()}>
            {t.save}
          </Button>
          <Button
            disabled={save.isPending || !ruReady}
            title={ruReady ? undefined : t.publishHint}
            onClick={() => submit('published')}
          >
            {t.publish}
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
            { value: 'edit' as const, label: t.tabEditor },
            { value: 'preview' as const, label: t.tabPreview },
          ]}
        />
      </div>

      {/* min-w-0 на колонках обязателен: у элемента сетки минимальная ширина по
          умолчанию равна min-content, и панель форматирования из 12 кнопок
          растягивала бы всю страницу вместо того, чтобы прокручиваться сама */}
      {/* Пополам на ноутбуке и фиксированное превью на широком экране.
          minmax(_,720px) во второй колонке не годился: свободное место
          раздаётся до растяжения 1fr, поэтому превью забирало свои 720, а
          редактору на экране 1280 оставалось 224 px. */}
      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_720px]">
        <div className={clsx(tab === 'edit' ? 'block' : 'hidden', 'min-w-0 xl:block')}>{editor}</div>
        <div className={clsx(tab === 'preview' ? 'block' : 'hidden', 'min-w-0 xl:block')}>
          <div className="xl:sticky xl:top-24">{preview}</div>
        </div>
      </div>
    </div>
  );
}
