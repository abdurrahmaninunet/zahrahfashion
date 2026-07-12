import type { MetadataRoute } from 'next';

/** Web app manifest (replaces the previously-missing /manifest.json). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zahra Fashion',
    short_name: 'Zahra',
    description: 'Premium lace, ankara, perfumes and gift packages — delivered across Abuja and Nigeria.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf5e6',
    theme_color: '#8a6d1f',
    icons: [],
  };
}
