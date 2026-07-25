import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
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
