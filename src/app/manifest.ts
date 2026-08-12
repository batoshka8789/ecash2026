import type { MetadataRoute } from 'next';

/**
 * Манифест установки на домашний экран. Он один на весь сайт — Next отдаёт
 * его по фиксированному адресу вне сегмента локали, поэтому языковую версию
 * здесь выбрать нельзя. Тексты русские, и `lang` это честно объявляет: без
 * него браузер считал бы язык по умолчанию английским и мог бы, например,
 * не так расставить направление текста.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    lang: 'ru',
    dir: 'ltr',
    name: 'ecash — обмен валют',
    short_name: 'ecash',
    description: 'Курсы валют, бронирование и обменники рядом с вами',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#f15a25',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
