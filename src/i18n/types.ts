import 'react-i18next';
import plCommon from './locales/pl/common.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof plCommon;
    };
  }
}
