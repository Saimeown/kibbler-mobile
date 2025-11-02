import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';

interface DeviceOnlineStatus {
  isDeviceOnline: boolean;
  batteryLevel: number | null;
}

export const useDeviceOnlineStatus = (): DeviceOnlineStatus => {
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [lastSeenTime, setLastSeenTime] = useState<number>(Date.now());
  
  // MATCHES WEB: 120 second threshold
  const OFFLINE_THRESHOLD_SECONDS = 120;

  // Monitor device_status for last_seen updates (MATCHES WEB LOGIC)
  useEffect(() => {
    const deviceStatusRef = ref(database, '/devices/kibbler_001/device_status');
    
    const unsubscribe = onValue(deviceStatusRef, (snapshot) => {
      const deviceStatus = snapshot.val();
      
      if (deviceStatus && deviceStatus.last_seen) {
        const lastSeen = new Date(deviceStatus.last_seen).getTime();
        const now = Date.now();
        const secondsSinceLastSeen = (now - lastSeen) / 1000;
        
        const isOnline = secondsSinceLastSeen < OFFLINE_THRESHOLD_SECONDS;
        
        console.log('Device Status Check:', {
          lastSeen: new Date(lastSeen).toISOString(),
          secondsSinceLastSeen: Math.round(secondsSinceLastSeen),
          isOnline,
          threshold: OFFLINE_THRESHOLD_SECONDS
        });
        
        setIsDeviceOnline(isOnline);
        setLastSeenTime(lastSeen);
        
        // Update battery level
        if (deviceStatus.battery_level !== undefined && deviceStatus.battery_level !== null) {
          setBatteryLevel(deviceStatus.battery_level);
        }
      }
    }, (error) => {
      console.error('Device status listener error:', error);
      setIsDeviceOnline(false);
    });

    return () => unsubscribe();
  }, []);

  // Periodic check (every 10 seconds) to update online status
  useEffect(() => {
    const checkOnlineStatus = () => {
      const now = Date.now();
      const secondsSinceLastSeen = (now - lastSeenTime) / 1000;
      const isOnline = secondsSinceLastSeen < OFFLINE_THRESHOLD_SECONDS;
      
      setIsDeviceOnline(isOnline);
    };

    const interval = setInterval(checkOnlineStatus, 10000);
    return () => clearInterval(interval);
  }, [lastSeenTime]);

  return {
    isDeviceOnline,
    batteryLevel
  };
};