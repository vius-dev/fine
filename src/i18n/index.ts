import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

const RESOURCES = {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
};

const LANGUAGE_DETECTOR = {
    type: 'languageDetector' as const,
    async: true,
    detect: async (callback: (lang: string) => void) => {
        try {
            const storedLanguage = await AsyncStorage.getItem('user-language');
            if (storedLanguage) {
                return callback(storedLanguage);
            }
        } catch (error) {
            console.error('Error reading language', error);
        }

        // Fallback to device locale
        const locale = Localization.getLocales()[0];
        callback(locale?.languageCode ?? 'en');
    },
    init: () => { },
    cacheUserLanguage: async (language: string) => {
        try {
            await AsyncStorage.setItem('user-language', language);
        } catch (error) {
            console.error('Error saving language', error);
        }
    },
};

i18n
    .use(LANGUAGE_DETECTOR)
    .use(initReactI18next)
    .init({
        resources: RESOURCES,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        cleanCode: true, // language will be lowercased (en-US -> en)
    });

export default i18n;
