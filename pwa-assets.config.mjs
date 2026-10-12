import { defineConfig } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    transparent: {
      sizes: [32, 64, 192, 512],
      favicons: [[48, '../../../public/favicon.ico']],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#0B1220' },
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#0B1220' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#0B1220' },
    },
    assetName(type, size) {
      if (type === 'apple') {
        return '../../../public/apple-touch-icon.png';
      }
      if (type === 'maskable') {
        return `../../../public/maskable-icon-${size.width}x${size.height}.png`;
      }
      if (size.width === 32) {
        return '../../../public/favicon-32x32.png';
      }
      return `../../../public/pwa-${size.width}x${size.height}.png`;
    },
  },
  images: ['src/assets/brand/omninauka-app-icon-source.png'],
});
