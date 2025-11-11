// المسار: MainApp.tsx
// المصدر: [شاشة-المسجد-الرقيمة/MainApp.tsx] (تم ترحيله بالكامل إلى RN/NativeWind)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, AppState as RNAppState, AppStateStatus } from 'react-native';
// استيراد المكونات المُرحّلة
import { Header } from './src/components/Header';
import { PrayerTimes } from './src/components/PrayerTimes';
import { Footer } from './src/components/Footer';
import { AdminScreen } from './src/components/AdminScreen';
import { DimScreen } from './src/components/DimScreen';
import { AdhkarScreen } from './src/components/AdhkarScreen';
import { SettingsButton } from './src/components/SettingsButton';
import { AlertScreen } from './src/components/AlertScreen';
import { SpecialPrayerTimes } from './src/components/SpecialPrayerTimes';
import { GeolocationPrompt } from './src/components/GeolocationPrompt';
// استيراد الـ Hooks المُرحّلة
import { usePrayerTimes } from './src/hooks/usePrayerTimes';
import { useSettings } from './src/contexts/SettingsContext';
import { useLocale } from './src/contexts/LocaleContext';
// استيراد الأنواع
import type { Prayer, PrayerWithIqamah, AppSettings } from './src/types';
import { PrayerName } from './src/types';
// استيراد واجهات برمجة التطبيقات (APIs) المُرحّلة
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { activateKeepAwake } from 'expo-keep-awake'; //
import { StatusBar } from 'expo-status-bar';

//
const addMinutesToTime = (time: string, minutes: number): string => {
    if (!time || !time.includes(':')) return '';
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + minutes);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
};

export const MainApp: React.FC = () => {
  const { settings, saveSettings } = useSettings();
  const { t } = useLocale();

  const [coordinates, setCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  //
  const isAnyPrayerAuto = useMemo(() => {
    return Object.values(settings.calculationMethods).some(method => method === 'auto');
  }, [settings.calculationMethods]);
  
  //
  const { prayerTimes: dynamicPrayerTimes, loading: prayersLoading, error: prayersError } = usePrayerTimes(isAnyPrayerAuto ? coordinates : null);
  
  //
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextPrayer, setNextPrayer] = useState<Prayer | null>(null);
  const [timeToNextIqamah, setTimeToNextIqamah] = useState('');
  const [prayerForIqamah, setPrayerForIqamah] = useState<Prayer | null>(null);

  const [isAdminScreenOpen, setAdminScreenOpen] = useState(false);
  const [appState, setAppState] = useState<'normal' | 'alert' | 'dimmed' | 'adhkar'>('normal');
  
  const loading = (isAnyPrayerAuto && locationLoading) || prayersLoading;
  
  const isFriday = useMemo(() => currentTime.getDay() === 5, [currentTime]);
  
  // تفعيل بقاء الشاشة نشطة بشكل دائم (Native Feature)
  useEffect(() => {
    activateKeepAwake();
  }, []);

  //
  const fetchCoordinates = useCallback(async (forcePermissionRequest = false) => {
    setShowLocationPrompt(false);
    setLocationLoading(true);
    setLocationError(null);
    await AsyncStorage.setItem('geolocation-prompted', 'true');

    try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            setLocationError(t('locationErrorText'));
            setCoordinates(null);
            return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setCoordinates({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });
    } catch (err) {
        setLocationError(t('locationErrorText'));
        setCoordinates(null);
    } finally {
        setLocationLoading(false);
    }
  }, [t]);

  //
  const handleSkipGeolocation = async () => {
    await AsyncStorage.setItem('geolocation-prompted', 'true');
    setShowLocationPrompt(false);
  };

  //
  useEffect(() => {
    if (!isAnyPrayerAuto) return;
    (async () => {
        const prompted = await AsyncStorage.getItem('geolocation-prompted');
        if (!prompted) {
            setShowLocationPrompt(true);
        } else {
            fetchCoordinates();
        }
    })();
  }, [isAnyPrayerAuto, fetchCoordinates]);

  //
  const prayerData = useMemo(() => {
    const prayerNamesWithIqamah: PrayerWithIqamah[] = [PrayerName.Fajr, PrayerName.Dhuhr, PrayerName.Asr, PrayerName.Maghrib, PrayerName.Isha];

    let currentMainPrayers: Prayer[] = prayerNamesWithIqamah.map(name => {
        const calculationMethod = settings.calculationMethods[name];
        let adhanTime: string;

        if (calculationMethod === 'manual') {
            adhanTime = settings.manualPrayerTimes[name] || '00:00';
        } else { // 'auto'
            const dynamicPrayer = dynamicPrayerTimes.find(p => p.name === name);
            adhanTime = dynamicPrayer?.time || '00:00';
        }

        return {
            name: name,
            time: adhanTime,
            iqamah: addMinutesToTime(adhanTime, settings.iqamahOffsets[name]),
        };
    });
    
    if (isFriday) {
        currentMainPrayers = currentMainPrayers.filter(p => p.name !== PrayerName.Dhuhr);
    }
    
    const prayerOrder = [PrayerName.Fajr, PrayerName.Dhuhr, PrayerName.Asr, PrayerName.Maghrib, PrayerName.Isha];
    currentMainPrayers.sort((a, b) => prayerOrder.indexOf(a.name) - prayerOrder.indexOf(b.name));
    
    const specialPrayers: Prayer[] = [];

    const dynamicSunrise = dynamicPrayerTimes.find(p => p.name === PrayerName.Sunrise);
    if (dynamicSunrise) {
        specialPrayers.push(dynamicSunrise);
    }
    
    const jumuahPrayer: Prayer = {
        name: PrayerName.Jumuah,
        time: settings.jumuahTime,
    };
    if (isFriday) {
        jumuahPrayer.iqamah = addMinutesToTime(settings.jumuahTime, settings.iqamahOffsets.Dhuhr);
    }
    specialPrayers.push(jumuahPrayer);
    
    return { mainPrayers: currentMainPrayers, specialPrayers };
  }, [settings, dynamicPrayerTimes, isFriday]);

  //
  const getNextPrayerInfo = useCallback((currentPrayers: Prayer[]) => {
    if (currentPrayers.length === 0) return;
    
    const now = new Date();
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();

    const sortedPrayersByAdhan = [...currentPrayers].filter(p => p.time && p.time.includes(':')).sort((a, b) => {
      const aTime = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
      const bTime = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]);
      return aTime - bTime;
    });

    let upcomingAdhanPrayer = sortedPrayersByAdhan.find(p => {
        const adhanInMinutes = parseInt(p.time.split(':')[0]) * 60 + parseInt(p.time.split(':')[1]);
        return adhanInMinutes > nowInMinutes;
    });
    if (!upcomingAdhanPrayer) {
      upcomingAdhanPrayer = sortedPrayersByAdhan[0];
    }
    setNextPrayer(upcomingAdhanPrayer);

    const sortedPrayersByIqamah = [...currentPrayers]
        .filter(p => p.iqamah && p.iqamah.includes(':'))
        .sort((a, b) => {
            const aTime = parseInt(a.iqamah!.split(':')[0]) * 60 + parseInt(a.iqamah!.split(':')[1]);
            const bTime = parseInt(b.iqamah!.split(':')[0]) * 60 + parseInt(b.iqamah!.split(':')[1]);
            return aTime - bTime;
        });

    let upcomingIqamahPrayer = sortedPrayersByIqamah.find(p => {
        const iqamahInMinutes = parseInt(p.iqamah!.split(':')[0]) * 60 + parseInt(p.iqamah!.split(':')[1]);
        return iqamahInMinutes > nowInMinutes;
    });
    
    let isIqamahTomorrow = false;
    if (!upcomingIqamahPrayer) {
        upcomingIqamahPrayer = sortedPrayersByIqamah[0];
        isIqamahTomorrow = true;
    }
    setPrayerForIqamah(upcomingIqamahPrayer);
    
    if (!upcomingIqamahPrayer?.iqamah) return;

    const iqamahTargetDate = new Date();
    if(isIqamahTomorrow) {
        iqamahTargetDate.setDate(iqamahTargetDate.getDate() + 1);
    }
    const [h, m] = upcomingIqamahPrayer.iqamah.split(':').map(Number);
    iqamahTargetDate.setHours(h, m, 0, 0);
    
    let diff = iqamahTargetDate.getTime() - now.getTime();
    const hours = Math.floor(diff / 1000 / 60 / 60);
    diff -= hours * 1000 * 60 * 60;
    const minutes = Math.floor(diff / 1000 / 60);
    diff -= minutes * 1000 * 60;
    const seconds = Math.floor(diff / 1000);

    setTimeToNextIqamah(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

  }, []);

  //
  useEffect(() => {
    const timerId = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const allPrayersForCalculation = [...prayerData.mainPrayers, ...prayerData.specialPrayers].filter(p => p.time);
      getNextPrayerInfo(allPrayersForCalculation);
      
      if (now.getSeconds() === 0 && allPrayersForCalculation.length > 0) {
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const isIqamahTime = allPrayersForCalculation.some(p => p.iqamah === nowTime);
  
        if (isIqamahTime && appState === 'normal') {
          setAppState('alert');
        }
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [prayerData, getNextPrayerInfo, appState]);
  
  //
  useEffect(() => {
    if (appState === 'alert') {
        const timer = setTimeout(() => {
            if (settings.dimDuration > 0) {
                setAppState('dimmed');
            } else if (settings.adhkarDuration > 0) {
                setAppState('adhkar');
            } else {
                setAppState('normal');
            }
        }, 60 * 1000); // 1 minute
        return () => clearTimeout(timer);
    }

    if (appState === 'dimmed') {
        const timer = setTimeout(() => {
            if (settings.adhkarDuration > 0) {
                setAppState('adhkar');
            } else {
                setAppState('normal');
            }
        }, settings.dimDuration * 60 * 1000);
        return () => clearTimeout(timer);
    }
  }, [appState, settings.dimDuration, settings.adhkarDuration]);

  //
  const openAdminScreen = useCallback(() => {
    setAdminScreenOpen(true);
  }, []);

  //
  const closeAdminScreen = useCallback(() => {
    setAdminScreenOpen(false);
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
    saveSettings(newSettings);
  };

  return (
    // استخدام SafeAreaView و NativeWind className
    <SafeAreaView className="bg-black text-white h-full flex-1 overflow-hidden p-1 sm:p-2 md:p-4">
      {/* تطبيق ملء الشاشة الدائم */}
      <StatusBar hidden={true} />
      
      <Header currentTime={currentTime} mosqueName={settings.mosqueName} />
      <View className="flex-grow flex flex-col items-center justify-center w-full overflow-hidden py-1">
         {loading && (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#22C55E" />
                <Text className="text-2xl text-gray-400 mt-4">{t('loadingSettings')}</Text>
            </View>
         )}
         {isAnyPrayerAuto && !loading && (locationError || prayersError) && (
            <View className="text-center p-4 bg-yellow-900/50 border border-yellow-400/50 rounded-lg">
                <Text className="text-xl text-yellow-300 font-bold">
                    {locationError ? t('locationErrorTitle') : t('prayerTimesErrorTitle')}
                </Text>
                <Text className="text-gray-300">{locationError || prayersError}</Text>
                <Text className="text-gray-400 mt-1">{t('defaultTimesMessage')}</Text>
            </View>
         )}
         {(!loading || !isAnyPrayerAuto) && !locationError && !prayersError && (
            <>
                <PrayerTimes prayers={prayerData.mainPrayers} nextPrayerName={nextPrayer?.name} />
                <SpecialPrayerTimes prayers={prayerData.specialPrayers} nextPrayerName={nextPrayer?.name} />
            </>
         )}
      </View>
      <Footer prayerForIqamah={prayerForIqamah} timeToNextIqamah={timeToNextIqamah} />
      
      {/* حذفنا زر ملء الشاشة */}
      <SettingsButton onClick={openAdminScreen} />

      {showLocationPrompt && (
          <GeolocationPrompt 
              onConfirm={() => fetchCoordinates(true)}
              onSkip={handleSkipGeolocation}
              onClose={handleSkipGeolocation}
          />
      )}
      {appState === 'alert' && <AlertScreen />}
      {appState === 'dimmed' && <DimScreen />}
      {appState === 'adhkar' && <AdhkarScreen duration={settings.adhkarDuration} onFinish={() => setAppState('normal')} />}
      <AdminScreen 
        isOpen={isAdminScreenOpen} 
        onClose={closeAdminScreen}
        onRefreshLocation={() => fetchCoordinates(true)}
        isRefreshingLocation={locationLoading}
        refreshError={locationError}
        saveSettings={handleSaveSettings}
      />
    </SafeAreaView>
  );
};