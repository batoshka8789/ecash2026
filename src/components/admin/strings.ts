'use client';

import { useLocale } from 'next-intl';
import type { ImageFocus, Locale } from '@/lib/domain';

/**
 * Тексты редакции.
 *
 * Намеренно НЕ в messages/*.json: словарь next-intl уезжает в браузер каждому
 * посетителю целиком, а эти девяносто с лишним строк нужны трём людям. Здесь
 * они импортируются только компонентами админки, поэтому попадают в её кусок
 * бандла и никому больше ничего не стоят.
 *
 * Тип задан одним объектом — если в русском появится ключ, а в казахском нет,
 * это не соберётся.
 */

export type AdminStrings = {
  section: string;
  news: string;
  toCabinet: string;

  // библиотека
  libraryTitle: string;
  /** «5 материалов · 3 опубликовано · 2 в черновиках» */
  summary: (all: number, published: number, draft: number) => string;
  loading: string;
  create: string;
  createFirst: string;
  searchPlaceholder: string;
  searchLabel: string;
  filterAll: string;
  filterDrafts: string;
  filterPublished: string;
  loadFailed: string;
  retry: string;
  emptyAll: string;
  emptyFound: string;
  statusPublished: string;
  statusDraft: string;
  languages: string;
  languagesNone: string;
  noTitle: string;
  noText: string;
  openOnSite: string;
  open: (title: string) => string;
  unpublish: string;
  publish: string;
  remove: string;
  removeTitle: string;
  removeWarning: string;
  cancel: string;
  close: string;
  unpublished: string;
  removed: string;

  // редактор
  backToList: string;
  unsaved: string;
  save: string;
  saved: string;
  published: string;
  publishHint: string;
  tabEditor: string;
  tabPreview: string;
  required: string;
  fallbackHint: string;
  fieldTitle: string;
  titlePlaceholder: string;
  titleHint: string;
  fieldCover: string;
  coverHint: string;
  fieldExcerpt: string;
  excerptHint: string;
  excerptPlaceholder: string;
  fieldBody: string;
  bodyPlaceholder: string;
  fieldSlug: string;
  slugHint: string;

  // превью
  screenPage: string;
  screenFeed: string;
  screenSize: string;
  deviceDesktop: string;
  deviceMobile: string;
  previewNote: (width: number) => string;
  previewTitle: string;
  previewAllNews: string;
  previewToday: string;

  // панель форматирования
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  mark: string;
  h2: string;
  h3: string;
  bullet: string;
  ordered: string;
  quote: string;
  callout: string;
  divider: string;
  link: string;
  linkPlaceholder: string;
  linkApply: string;
  linkRemove: string;
  linkCancel: string;
  textColor: string;
  colorDefault: string;
  colorCustom: string;
  fontFamily: string;
  fontSans: string;
  fontSerif: string;
  fontDisplay: string;
  fontGeometric: string;
  fontMono: string;
  align: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  clearFormat: string;
  fontSize: string;

  // обложка
  wholeImage: string;
  showCrop: string;
  cropGroup: string;
  cropTo: (place: string) => string;
  cropCurrent: (place: string) => string;
  focus: Record<ImageFocus, string>;
  dropHere: string;
  dropTypes: string;
  uploading: string;
  replace: string;

  // перевод
  translate: string;
  translateOne: (language: string) => string;
  translating: string;
  translated: (languages: string) => string;
  translateNeedsRu: string;
  translateNote: string;
  languageName: Record<Locale, string>;
};

const ru: AdminStrings = {
  section: 'Редакция',
  news: 'Новости',
  toCabinet: 'В кабинет',

  libraryTitle: 'Библиотека новостей',
  summary: (all, published, draft) =>
    `${all} ${plural(all, 'материал', 'материала', 'материалов')} · ${published} опубликовано · ${draft} в черновиках`,
  loading: 'Загружаю…',
  create: 'Создать новость',
  createFirst: 'Создать первую',
  searchPlaceholder: 'Поиск по заголовку или адресу',
  searchLabel: 'Поиск по новостям',
  filterAll: 'Все',
  filterDrafts: 'Черновики',
  filterPublished: 'Опубликованы',
  loadFailed: 'Не удалось загрузить список',
  retry: 'Повторить',
  emptyAll: 'Пока ни одной новости',
  emptyFound: 'Ничего не найдено',
  statusPublished: 'Опубликовано',
  statusDraft: 'Черновик',
  languages: 'Языки',
  languagesNone: 'нет',
  noTitle: '(без заголовка)',
  noText: 'Текста пока нет',
  openOnSite: 'Открыть на сайте',
  open: (title) => `Открыть «${title}»`,
  unpublish: 'Снять',
  publish: 'Опубликовать',
  remove: 'Удалить',
  removeTitle: 'Удалить новость?',
  removeWarning: 'Отменить это действие будет нельзя.',
  cancel: 'Отмена',
  close: 'Закрыть',
  unpublished: 'Снято с публикации',
  removed: 'Новость удалена',

  backToList: 'К списку',
  unsaved: 'Есть несохранённые правки',
  save: 'Сохранить',
  saved: 'Сохранено',
  published: 'Опубликовано',
  publishHint: 'Для публикации заполните русский заголовок и текст',
  tabEditor: 'Редактор',
  tabPreview: 'Превью',
  required: 'обязательно',
  fallbackHint: 'без перевода покажем русский',
  fieldTitle: 'Заголовок',
  titlePlaceholder: 'Например: Новые условия обмена',
  titleHint: 'Виден в ленте, на странице и во вкладке браузера',
  fieldCover: 'Обложка',
  coverHint: 'кадр выбирается сеткой на картинке',
  fieldExcerpt: 'Анонс для ленты',
  excerptHint: 'пусто — возьмём начало текста',
  excerptPlaceholder: 'Короткая выжимка',
  fieldBody: 'Текст новости',
  bodyPlaceholder: 'Начните печатать текст новости…',
  fieldSlug: 'Адрес страницы',
  slugHint: 'пусто — создадим из заголовка',

  screenPage: 'Страница',
  screenFeed: 'Лента',
  screenSize: 'Размер экрана',
  deviceDesktop: 'Компьютер',
  deviceMobile: 'Телефон',
  previewNote: (w) =>
    `Настоящая ширина ${w} px, уменьшена под колонку — так видно ровно ту вёрстку, которую получит посетитель.`,
  previewTitle: 'Заголовок новости',
  previewAllNews: 'Все новости',
  previewToday: 'сегодня',

  bold: 'Жирный',
  italic: 'Курсив',
  underline: 'Подчёркнутый',
  strike: 'Зачёркнутый',
  mark: 'Выделить цветом',
  h2: 'Заголовок',
  h3: 'Подзаголовок',
  bullet: 'Список',
  ordered: 'Нумерованный список',
  quote: 'Цитата',
  callout: 'Врезка-примечание',
  divider: 'Разделитель',
  link: 'Ссылка',
  linkPlaceholder: 'ecash.kz/franchise',
  linkApply: 'Готово',
  linkRemove: 'Убрать ссылку',
  linkCancel: 'Отмена',
  textColor: 'Цвет текста',
  colorDefault: 'Обычный',
  colorCustom: 'Свой цвет',
  fontFamily: 'Шрифт',
  fontSans: 'Обычный',
  fontSerif: 'С засечками',
  fontDisplay: 'Заголовочный',
  fontGeometric: 'Геометрический',
  fontMono: 'Моноширинный',
  align: 'Выравнивание',
  alignLeft: 'По левому краю',
  alignCenter: 'По центру',
  alignRight: 'По правому краю',
  clearFormat: 'Очистить форматирование',
  fontSize: 'Размер текста',

  wholeImage: 'Вся картинка',
  showCrop: 'Показать кадр',
  cropGroup: 'Что оставить в кадре',
  cropTo: (place) => `Кадрировать ${place}`,
  cropCurrent: (place) => `кадр: ${place}`,
  focus: {
    '0% 0%': 'сверху слева',
    '50% 0%': 'сверху по центру',
    '100% 0%': 'сверху справа',
    '0% 50%': 'слева',
    '50% 50%': 'по центру',
    '100% 50%': 'справа',
    '0% 100%': 'снизу слева',
    '50% 100%': 'снизу по центру',
    '100% 100%': 'снизу справа',
  },
  dropHere: 'Перетащите картинку или нажмите, чтобы выбрать',
  dropTypes: 'JPG, PNG, WebP · до 8 МБ · лучше 1440×720',
  uploading: 'Загружаю…',
  replace: 'Заменить',

  translate: 'Перевести на все языки',
  translateOne: (language) => `Перевести на ${language}`,
  translating: 'Перевожу…',
  translated: (languages) => `Переведено: ${languages}. Проверьте текст перед публикацией.`,
  translateNeedsRu: 'Сначала заполните русский заголовок и текст',
  translateNote: 'Машинный перевод — проверьте перед публикацией',
  languageName: { ru: 'русский', en: 'английский', kk: 'казахский', zh: 'китайский' },
};

const en: AdminStrings = {
  section: 'Editorial',
  news: 'News',
  toCabinet: 'Back to account',

  libraryTitle: 'News library',
  summary: (all, published, draft) =>
    `${all} ${all === 1 ? 'item' : 'items'} · ${published} published · ${draft} in drafts`,
  loading: 'Loading…',
  create: 'New post',
  createFirst: 'Create the first one',
  searchPlaceholder: 'Search by title or address',
  searchLabel: 'Search news',
  filterAll: 'All',
  filterDrafts: 'Drafts',
  filterPublished: 'Published',
  loadFailed: 'Could not load the list',
  retry: 'Try again',
  emptyAll: 'No posts yet',
  emptyFound: 'Nothing found',
  statusPublished: 'Published',
  statusDraft: 'Draft',
  languages: 'Languages',
  languagesNone: 'none',
  noTitle: '(untitled)',
  noText: 'No text yet',
  openOnSite: 'Open on the site',
  open: (title) => `Open “${title}”`,
  unpublish: 'Unpublish',
  publish: 'Publish',
  remove: 'Delete',
  removeTitle: 'Delete this post?',
  removeWarning: 'This cannot be undone.',
  cancel: 'Cancel',
  close: 'Close',
  unpublished: 'Unpublished',
  removed: 'Post deleted',

  backToList: 'Back to list',
  unsaved: 'You have unsaved changes',
  save: 'Save',
  saved: 'Saved',
  published: 'Published',
  publishHint: 'Fill in the Russian title and text to publish',
  tabEditor: 'Editor',
  tabPreview: 'Preview',
  required: 'required',
  fallbackHint: 'without a translation we show Russian',
  fieldTitle: 'Title',
  titlePlaceholder: 'For example: New exchange terms',
  titleHint: 'Shown in the feed, on the page and in the browser tab',
  fieldCover: 'Cover',
  coverHint: 'pick the crop with the grid on the image',
  fieldExcerpt: 'Feed summary',
  excerptHint: 'leave empty — we take the beginning of the text',
  excerptPlaceholder: 'A short summary',
  fieldBody: 'Post text',
  bodyPlaceholder: 'Start typing the post text…',
  fieldSlug: 'Page address',
  slugHint: 'leave empty — we build it from the title',

  screenPage: 'Page',
  screenFeed: 'Feed',
  screenSize: 'Screen size',
  deviceDesktop: 'Desktop',
  deviceMobile: 'Phone',
  previewNote: (w) =>
    `Real width ${w} px, scaled down to the column — this is exactly the layout a visitor gets.`,
  previewTitle: 'Post title',
  previewAllNews: 'All news',
  previewToday: 'today',

  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  mark: 'Highlight',
  h2: 'Heading',
  h3: 'Subheading',
  bullet: 'Bulleted list',
  ordered: 'Numbered list',
  quote: 'Quote',
  callout: 'Callout',
  divider: 'Divider',
  link: 'Link',
  linkPlaceholder: 'ecash.kz/franchise',
  linkApply: 'Done',
  linkRemove: 'Remove link',
  linkCancel: 'Cancel',
  textColor: 'Text color',
  colorDefault: 'Default',
  colorCustom: 'Custom color',
  fontFamily: 'Font',
  fontSans: 'Default',
  fontSerif: 'Serif',
  fontDisplay: 'Display',
  fontGeometric: 'Geometric',
  fontMono: 'Monospace',
  align: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  clearFormat: 'Clear formatting',
  fontSize: 'Text size',

  wholeImage: 'Whole image',
  showCrop: 'Show the crop',
  cropGroup: 'What to keep in frame',
  cropTo: (place) => `Crop to ${place}`,
  cropCurrent: (place) => `crop: ${place}`,
  focus: {
    '0% 0%': 'top left',
    '50% 0%': 'top center',
    '100% 0%': 'top right',
    '0% 50%': 'left',
    '50% 50%': 'center',
    '100% 50%': 'right',
    '0% 100%': 'bottom left',
    '50% 100%': 'bottom center',
    '100% 100%': 'bottom right',
  },
  dropHere: 'Drag an image here, or click to choose one',
  dropTypes: 'JPG, PNG, WebP · up to 8 MB · 1440×720 works best',
  uploading: 'Uploading…',
  replace: 'Replace',

  translate: 'Translate into all languages',
  translateOne: (language) => `Translate into ${language}`,
  translating: 'Translating…',
  translated: (languages) => `Translated: ${languages}. Check the text before publishing.`,
  translateNeedsRu: 'Fill in the Russian title and text first',
  translateNote: 'Machine translation — check it before publishing',
  languageName: { ru: 'Russian', en: 'English', kk: 'Kazakh', zh: 'Chinese' },
};

const kk: AdminStrings = {
  section: 'Редакция',
  news: 'Жаңалықтар',
  toCabinet: 'Кабинетке',

  libraryTitle: 'Жаңалықтар кітапханасы',
  summary: (all, published, draft) =>
    `${all} материал · ${published} жарияланған · ${draft} жоба`,
  loading: 'Жүктелуде…',
  create: 'Жаңалық құру',
  createFirst: 'Алғашқысын құру',
  searchPlaceholder: 'Тақырып немесе мекенжай бойынша іздеу',
  searchLabel: 'Жаңалықтардан іздеу',
  filterAll: 'Барлығы',
  filterDrafts: 'Жобалар',
  filterPublished: 'Жарияланған',
  loadFailed: 'Тізімді жүктеу мүмкін болмады',
  retry: 'Қайталау',
  emptyAll: 'Әзірге жаңалық жоқ',
  emptyFound: 'Ештеңе табылмады',
  statusPublished: 'Жарияланған',
  statusDraft: 'Жоба',
  languages: 'Тілдер',
  languagesNone: 'жоқ',
  noTitle: '(тақырыпсыз)',
  noText: 'Мәтін әзірге жоқ',
  openOnSite: 'Сайтта ашу',
  open: (title) => `«${title}» ашу`,
  unpublish: 'Алып тастау',
  publish: 'Жариялау',
  remove: 'Жою',
  removeTitle: 'Жаңалықты жою керек пе?',
  removeWarning: 'Бұл әрекетті кері қайтару мүмкін болмайды.',
  cancel: 'Болдырмау',
  close: 'Жабу',
  unpublished: 'Жарияланымнан алынды',
  removed: 'Жаңалық жойылды',

  backToList: 'Тізімге',
  unsaved: 'Сақталмаған өзгерістер бар',
  save: 'Сақтау',
  saved: 'Сақталды',
  published: 'Жарияланды',
  publishHint: 'Жариялау үшін орыс тіліндегі тақырып пен мәтінді толтырыңыз',
  tabEditor: 'Редактор',
  tabPreview: 'Алдын ала қарау',
  required: 'міндетті',
  fallbackHint: 'аудармасыз орысша көрсетіледі',
  fieldTitle: 'Тақырып',
  titlePlaceholder: 'Мысалы: Айырбастаудың жаңа шарттары',
  titleHint: 'Таспада, бетте және браузер қойындысында көрінеді',
  fieldCover: 'Мұқаба',
  coverHint: 'кадр суреттегі тормен таңдалады',
  fieldExcerpt: 'Таспаға арналған анонс',
  excerptHint: 'бос — мәтіннің басын аламыз',
  excerptPlaceholder: 'Қысқаша мазмұны',
  fieldBody: 'Жаңалық мәтіні',
  bodyPlaceholder: 'Жаңалық мәтінін теруді бастаңыз…',
  fieldSlug: 'Бет мекенжайы',
  slugHint: 'бос — тақырыптан құрамыз',

  screenPage: 'Бет',
  screenFeed: 'Таспа',
  screenSize: 'Экран өлшемі',
  deviceDesktop: 'Компьютер',
  deviceMobile: 'Телефон',
  previewNote: (w) =>
    `Нақты ені ${w} px, бағанға сай кішірейтілген — келуші дәл осы көріністі алады.`,
  previewTitle: 'Жаңалық тақырыбы',
  previewAllNews: 'Барлық жаңалықтар',
  previewToday: 'бүгін',

  bold: 'Қалың',
  italic: 'Курсив',
  underline: 'Асты сызылған',
  strike: 'Сызылған',
  mark: 'Түспен бөлектеу',
  h2: 'Тақырып',
  h3: 'Ішкі тақырып',
  bullet: 'Тізім',
  ordered: 'Нөмірленген тізім',
  quote: 'Дәйексөз',
  callout: 'Ескертпе блогы',
  divider: 'Бөлгіш',
  link: 'Сілтеме',
  linkPlaceholder: 'ecash.kz/franchise',
  linkApply: 'Дайын',
  linkRemove: 'Сілтемені алып тастау',
  linkCancel: 'Болдырмау',
  textColor: 'Мәтін түсі',
  colorDefault: 'Әдепкі',
  colorCustom: 'Өз түсі',
  fontFamily: 'Қаріп',
  fontSans: 'Әдепкі',
  fontSerif: 'Serif',
  fontDisplay: 'Тақырыптық',
  fontGeometric: 'Геометриялық',
  fontMono: 'Моноширинды',
  align: 'Туралау',
  alignLeft: 'Сол жаққа туралау',
  alignCenter: 'Ортаға туралау',
  alignRight: 'Оң жаққа туралау',
  clearFormat: 'Пішімдеуді тазарту',
  fontSize: 'Мәтін өлшемі',

  wholeImage: 'Толық сурет',
  showCrop: 'Кадрды көрсету',
  cropGroup: 'Кадрда не қалады',
  cropTo: (place) => `Кадр: ${place}`,
  cropCurrent: (place) => `кадр: ${place}`,
  focus: {
    '0% 0%': 'жоғарыдан солға',
    '50% 0%': 'жоғарыдан ортаға',
    '100% 0%': 'жоғарыдан оңға',
    '0% 50%': 'солға',
    '50% 50%': 'ортаға',
    '100% 50%': 'оңға',
    '0% 100%': 'төменнен солға',
    '50% 100%': 'төменнен ортаға',
    '100% 100%': 'төменнен оңға',
  },
  dropHere: 'Суретті сүйреп әкеліңіз немесе таңдау үшін басыңыз',
  dropTypes: 'JPG, PNG, WebP · 8 МБ дейін · 1440×720 жақсырақ',
  uploading: 'Жүктелуде…',
  replace: 'Ауыстыру',

  translate: 'Барлық тілге аудару',
  translateOne: (language) => `${language} тіліне аудару`,
  translating: 'Аударылуда…',
  translated: (languages) => `Аударылды: ${languages}. Жарияламас бұрын мәтінді тексеріңіз.`,
  translateNeedsRu: 'Алдымен орысша тақырып пен мәтінді толтырыңыз',
  translateNote: 'Машиналық аударма — жарияламас бұрын тексеріңіз',
  languageName: { ru: 'орыс', en: 'ағылшын', kk: 'қазақ', zh: 'қытай' },
};

const zh: AdminStrings = {
  section: '编辑部',
  news: '新闻',
  toCabinet: '返回个人中心',

  libraryTitle: '新闻库',
  summary: (all, published, draft) => `共 ${all} 篇 · 已发布 ${published} · 草稿 ${draft}`,
  loading: '加载中…',
  create: '新建新闻',
  createFirst: '创建第一篇',
  searchPlaceholder: '按标题或网址搜索',
  searchLabel: '搜索新闻',
  filterAll: '全部',
  filterDrafts: '草稿',
  filterPublished: '已发布',
  loadFailed: '无法加载列表',
  retry: '重试',
  emptyAll: '还没有新闻',
  emptyFound: '未找到内容',
  statusPublished: '已发布',
  statusDraft: '草稿',
  languages: '语言',
  languagesNone: '无',
  noTitle: '（无标题）',
  noText: '暂无正文',
  openOnSite: '在网站上打开',
  open: (title) => `打开《${title}》`,
  unpublish: '取消发布',
  publish: '发布',
  remove: '删除',
  removeTitle: '要删除这篇新闻吗？',
  removeWarning: '此操作无法撤销。',
  cancel: '取消',
  close: '关闭',
  unpublished: '已取消发布',
  removed: '新闻已删除',

  backToList: '返回列表',
  unsaved: '有未保存的修改',
  save: '保存',
  saved: '已保存',
  published: '已发布',
  publishHint: '发布前请填写俄语标题和正文',
  tabEditor: '编辑器',
  tabPreview: '预览',
  required: '必填',
  fallbackHint: '没有译文时显示俄语',
  fieldTitle: '标题',
  titlePlaceholder: '例如：全新兑换条件',
  titleHint: '显示在信息流、详情页和浏览器标签上',
  fieldCover: '封面',
  coverHint: '用图片上的网格选择取景',
  fieldExcerpt: '信息流摘要',
  excerptHint: '留空则截取正文开头',
  excerptPlaceholder: '简短摘要',
  fieldBody: '新闻正文',
  bodyPlaceholder: '开始输入新闻正文…',
  fieldSlug: '页面网址',
  slugHint: '留空则根据标题生成',

  screenPage: '详情页',
  screenFeed: '信息流',
  screenSize: '屏幕尺寸',
  deviceDesktop: '电脑',
  deviceMobile: '手机',
  previewNote: (w) => `实际宽度 ${w} px，已按栏宽缩放——访客看到的就是这个版式。`,
  previewTitle: '新闻标题',
  previewAllNews: '全部新闻',
  previewToday: '今天',

  bold: '加粗',
  italic: '斜体',
  underline: '下划线',
  strike: '删除线',
  mark: '彩色高亮',
  h2: '标题',
  h3: '副标题',
  bullet: '项目符号列表',
  ordered: '编号列表',
  quote: '引用',
  callout: '提示框',
  divider: '分隔线',
  link: '链接',
  linkPlaceholder: 'ecash.kz/franchise',
  linkApply: '完成',
  linkRemove: '移除链接',
  linkCancel: '取消',
  textColor: '文字颜色',
  colorDefault: '默认',
  colorCustom: '自定义颜色',
  fontFamily: '字体',
  fontSans: '默认',
  fontSerif: '衬线体',
  fontDisplay: '标题体',
  fontGeometric: '几何无衬线',
  fontMono: '等宽字体',
  align: '对齐方式',
  alignLeft: '左对齐',
  alignCenter: '居中对齐',
  alignRight: '右对齐',
  clearFormat: '清除格式',
  fontSize: '文字大小',

  wholeImage: '完整图片',
  showCrop: '显示取景',
  cropGroup: '保留画面的哪一部分',
  cropTo: (place) => `取景：${place}`,
  cropCurrent: (place) => `取景：${place}`,
  focus: {
    '0% 0%': '左上',
    '50% 0%': '上中',
    '100% 0%': '右上',
    '0% 50%': '左侧',
    '50% 50%': '居中',
    '100% 50%': '右侧',
    '0% 100%': '左下',
    '50% 100%': '下中',
    '100% 100%': '右下',
  },
  dropHere: '将图片拖到此处，或点击选择',
  dropTypes: 'JPG、PNG、WebP · 最大 8 MB · 建议 1440×720',
  uploading: '上传中…',
  replace: '更换',

  translate: '翻译成所有语言',
  translateOne: (language) => `翻译成${language}`,
  translating: '翻译中…',
  translated: (languages) => `已翻译：${languages}。发布前请检查译文。`,
  translateNeedsRu: '请先填写俄语标题和正文',
  translateNote: '机器翻译——发布前请检查',
  languageName: { ru: '俄语', en: '英语', kk: '哈萨克语', zh: '中文' },
};

/** Склонение числительного: 1 материал / 2 материала / 5 материалов. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const ALL: Record<Locale, AdminStrings> = { ru, en, kk, zh };

export function useAdminStrings(): AdminStrings {
  const locale = useLocale() as Locale;
  return ALL[locale] ?? ru;
}
