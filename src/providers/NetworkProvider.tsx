import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';

interface NetworkContextType {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // Native fallback network check via fetch heartbeat
      let active = true;
      const checkNativeConnectivity = async () => {
        try {
          const res = await fetch('https://clients3.google.com/generate_204', {
            method: 'HEAD',
            cache: 'no-store',
          });
          if (active) setIsOnline(res.status === 204 || res.ok);
        } catch {
          if (active) setIsOnline(false);
        }
      };

      checkNativeConnectivity();
      const interval = setInterval(checkNativeConnectivity, 12000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus(): NetworkContextType {
  return useContext(NetworkContext);
}

export function useNetwork(): NetworkContextType {
  return useContext(NetworkContext);
}

