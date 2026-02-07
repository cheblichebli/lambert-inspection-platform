import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncAPI } from '../api';
import { db } from '../db';

const SyncStatus = ({ isOnline }) => {
  const [syncing, setSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    checkUnsyncedData();
    loadLastSyncTime();
  }, []);

  const checkUnsyncedData = async () => {
    try {
      const unsynced = await db.getUnsyncedInspections();
      setUnsyncedCount(unsynced.length);
    } catch (error) {
      console.error('Error checking unsynced data:', error);
    }
  };

  const loadLastSyncTime = async () => {
    try {
      const time = await db.getLastSyncTime();
      setLastSync(time);
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  };

  const handleSync = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      await syncAPI.syncInspections();
      await syncAPI.downloadOfflineData();
      await checkUnsyncedData();
      await loadLastSyncTime();
      alert('Sync completed successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={`sync-status ${isOnline ? 'online' : 'offline'}`}>
      <div className="sync-indicator">
        {isOnline ? (
          <>
            <Wifi size={16} />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff size={16} />
            <span>Offline</span>
          </>
        )}
      </div>

      {unsyncedCount > 0 && (
        <div className="unsynced-badge">
          {unsyncedCount} unsynced
        </div>
      )}

      {isOnline && (
        <button
          onClick={handleSync}
          className="btn-sync"
          disabled={syncing}
        >
          <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      )}
    </div>
  );
};

export default SyncStatus;
