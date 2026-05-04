import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import zh from './locales/zh.json';

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      zh: {
        translation: zh
      }
    },
    lng: 'zh', // Default language is Chinese
    fallbackLng: 'en',

    interpolation: {
      escapeValue: false // React already escapes by default
    }
  });

export default i18n;