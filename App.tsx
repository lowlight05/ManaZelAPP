// المسار: App.tsx (الملف الجذري)
// المصدر: [شاشة-المسجد-الرقيمة/App.tsx] (تم ترحيله بالكامل)

import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';

// 1. استيراد المزودات (Providers) من مجلد 'src'
import { SettingsProvider } from './src/contexts/SettingsContext';
import { LocaleProvider, useLocale } from './src/contexts/LocaleContext';

// 2. استيراد التطبيق الرئيسي (من الجذر)
import { MainApp } from './MainApp';

/**
 * غلاف داخلي لتطبيق اتجاه RTL/LTR
 * (هذا ضروري لأنه يجب استدعاء useLocale() *داخل* LocaleProvider)
 */
const MainAppWrapper = () => {
  const { direction } = useLocale();

  useEffect(() => {
    //
    // تطبيق اتجاه RTL/LTR على التطبيق بالكامل
    I18nManager.forceRTL(direction === 'rtl');
    // ملاحظة: في Expo، قد يتطلب تغيير هذا إعادة تحميل التطبيق يدوياً
  }, [direction]);

  return <MainApp />;
};

/**
 * المكون الجذري (Root Component)
 * يقوم بتغليف التطبيق بـ "مزودات السياق"
 */
export default function App() {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <MainAppWrapper />
      </LocaleProvider>
    </SettingsProvider>
  );
}