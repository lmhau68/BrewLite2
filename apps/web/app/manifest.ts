import type { MetadataRoute } from 'next';

/**
 * Manifest PWA tối thiểu (ADR-008, NFR-05).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrewLite — Menu đồ uống',
    short_name: 'BrewLite',
    description: 'Xem menu và đặt đồ uống tại quầy BrewLite.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#8b5a2b',
    lang: 'vi',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
