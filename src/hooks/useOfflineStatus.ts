import { useState, useEffect, useCallback } from 'react';
import { offlineSync } from '../lib/offlineSync';

interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType?: string;
  effectiveType?: string;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncTime?: Date;
  triggerSync: () => Promise<any>;
}

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<Omit<OfflineStatus, 'triggerSync'>>({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    pendingSyncCount: 0,
    isSyncing: false,
  });

  const updateStatus = useCallback(async () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    const pendingCount = await offlineSync.getPendingCount();
    
    setStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine,
      isOffline: !navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      pendingSyncCount: pendingCount,
      isSyncing: offlineSync.isCurrentlySyncing(),
    }));
  }, []);

  useEffect(() => {
    // Initial status
    updateStatus();

    // Listen for connection changes
    const unsubscribe = offlineSync.onConnectionChange((isOnline) => {
      setStatus(prev => ({
        ...prev,
        isOnline,
        isOffline: !isOnline,
      }));
      updateStatus();
    });

    // Listen for sync status changes
    const syncInterval = setInterval(() => {
      updateStatus();
    }, 5000); // Update every 5 seconds

    // Listen for connection API changes
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectionChange = () => updateStatus();
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateStatus]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (status.isOnline && !status.isSyncing) {
      try {
        const result = await offlineSync.syncAll();
        await updateStatus();
        return result;
      } catch (error) {
        console.error('Manual sync failed:', error);
        throw error;
      }
    }
  }, [status.isOnline, status.isSyncing, updateStatus]);

  return {
    ...status,
    triggerSync,
  };
}
