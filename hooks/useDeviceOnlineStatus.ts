import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';

interface DeviceOnlineStatus {
  isDeviceOnline: boolean;
  lastBatteryUpdate: number;
  batteryLevel: number;
}

export const useDeviceOnlineStatus = (): DeviceOnlineStatus => {
  const [lastBatteryUpdate, setLastBatteryUpdate] = useState<number>(Date.now());
  const [isDeviceOnline, setIsDeviceOnline] = useState(true);
  const [previousBatteryLevel, setPreviousBatteryLevel] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(0);
  
  // Configuration for offline detection (in milliseconds)
  const OFFLINE_TIMEOUT = 120000; // 2 minutes - adjust as needed

  // Monitor device online status based on battery data updates
  useEffect(() => {
    const checkOnlineStatus = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastBatteryUpdate;
      const isOnline = timeSinceLastUpdate < OFFLINE_TIMEOUT;
      
      console.log('Shared Online status check:', {
        timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000) + 's',
        isOnline,
        threshold: OFFLINE_TIMEOUT / 1000 + 's'
      });
      
      setIsDeviceOnline(isOnline);
    };

    // Check immediately and then every 10 seconds
    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 10000);

    return () => clearInterval(interval);
  }, [lastBatteryUpdate, OFFLINE_TIMEOUT]);

  // Separate listener for battery level changes to track real-time updates
  useEffect(() => {
    const batteryRef = ref(database, '/devices/kibbler_001/device_status/battery_level');
    
    const unsubscribeBattery = onValue(batteryRef, (snapshot) => {
      const newBatteryLevel = snapshot.val();
      if (newBatteryLevel !== null && newBatteryLevel !== undefined) {
        const now = Date.now();
        
        // Only update if battery level actually changed
        if (previousBatteryLevel !== null && newBatteryLevel !== previousBatteryLevel) {
          console.log('Shared - Battery level changed:', {
            previous: previousBatteryLevel,
            current: newBatteryLevel,
            timestamp: new Date(now).toLocaleTimeString()
          });
          setLastBatteryUpdate(now);
        }
        
        setPreviousBatteryLevel(newBatteryLevel);
        setBatteryLevel(newBatteryLevel);
      }
    }, (error) => {
      console.error('Shared - Battery listener error:', error);
    });

    return () => unsubscribeBattery();
  }, [previousBatteryLevel]);

  return {
    isDeviceOnline,
    lastBatteryUpdate,
    batteryLevel
  };
};