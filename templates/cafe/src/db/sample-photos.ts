const legacyPhotos: Record<string, string> = {
  '/images/menu/es-kopi-susu-aren.svg': '/images/menu/photos/kopi-aren.jpg',
  '/images/menu/es-kopi-susu-aren-2.svg': '/images/menu/photos/kopi-aren.jpg',
  '/images/menu/es-kopi-susu-aren-3.svg': '/images/menu/photos/kopi-aren.jpg',
  '/images/menu/manual-brew-v60.svg': '/images/menu/photos/v60.jpg',
  '/images/menu/manual-brew-v60-2.svg': '/images/menu/photos/v60.jpg',
  '/images/menu/nasi-ayam-rempah.svg': '/images/menu/photos/ayam.jpg',
  '/images/menu/nasi-ayam-rempah-2.svg': '/images/menu/photos/ayam.jpg',
  '/images/menu/matcha-latte-uji.svg': '/images/menu/photos/matcha.jpg',
  '/images/menu/croissant-mentega.svg': '/images/menu/photos/croissant.jpg',
};

export function samplePhotos(photos: string[]): string[] {
  return [...new Set(photos.filter(Boolean).map((photo) => legacyPhotos[photo] || photo))];
}
