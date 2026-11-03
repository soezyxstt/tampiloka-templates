interface SampleFinish {
  name: string;
  previousName?: string;
  images: [string, string];
}

// Images show one finish per sample product. Previous names identify existing SKUs.
export const sampleFinishes: Record<string, SampleFinish> = {
  'canvas-tote': { name: 'Khaki', previousName: 'Natural', images: ['/images/canvas-tote.webp', '/images/pouch-fastening.webp'] },
  'leather-sling': { name: 'Marun', previousName: 'Cokelat', images: ['/images/leather-sling.webp', '/images/bag-clasp.webp'] },
  'leather-wallet': { name: 'Cokelat', images: ['/images/wallet-closed.webp', '/images/wallet-open.webp'] },
  'ceramic-cup': { name: 'Putih', previousName: 'Pasir', images: ['/images/photo-1514228742587-6b1558fcca3d.webp', '/images/cup-glaze.webp'] },
  'woven-throw': { name: 'Natural', images: ['/images/woven-throw.webp', '/images/throw-stitch.webp'] },
};
