import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import plCommon from './locales/pl/common.json';
import enCommon from './locales/en/common.json';
import ukCommon from './locales/uk/common.json';
import deCommon from './locales/de/common.json';
import esCommon from './locales/es/common.json';
import itCommon from './locales/it/common.json';

const resources = {
  pl: { common: plCommon },
  en: { common: enCommon },
  uk: { common: ukCommon },
  de: { common: deCommon },
  es: { common: esCommon },
  it: { common: itCommon }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pl',
    supportedLngs: ['pl', 'en', 'uk', 'de', 'es', 'it'],
    defaultNS: 'common',
    
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
