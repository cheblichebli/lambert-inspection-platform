import Dexie from 'dexie';

export class LambertDB extends Dexie {
  constructor() {
    super('LambertInspectionDB');
    
    this.version(1).stores({
      forms: '++id, syncId, title, category, isActive',
      inspections: '++id, syncId, templateId, status, createdAt, synced',
      photos: '++id, syncId, inspectionSyncId, sequenceOrder',
      syncQueue: '++id, type, syncId, createdAt',
      settings: 'key'
    });

    this.forms = this.table('forms');
    this.inspections = this.table('inspections');
    this.photos = this.table('photos');
    this.syncQueue = this.table('syncQueue');
    this.settings = this.table('settings');
  }

  // Initialize database with server data
  async initializeOfflineData(data) {
    try {
      await this.transaction('rw', this.forms, this.inspections, this.photos, async () => {
        // Clear existing data
        await this.forms.clear();
        await this.inspections.clear();
        await this.photos.clear();

        // Add forms
        if (data.forms && data.forms.length > 0) {
          await this.forms.bulkAdd(data.forms.map(form => ({
            ...form,
            syncId: form.id,
            fields: typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields
          })));
        }

        // Add inspections
        if (data.inspections && data.inspections.length > 0) {
          await this.inspections.bulkAdd(data.inspections.map(inspection => ({
            ...inspection,
            data: typeof inspection.data === 'string' ? JSON.parse(inspection.data) : inspection.data,
            synced: true
          })));
        }

        // Add photos
        if (data.photos && data.photos.length > 0) {
          await this.photos.bulkAdd(data.photos);
        }

        // Update last sync time
        await this.settings.put({ key: 'lastSync', value: new Date().toISOString() });
      });

      console.log('✅ Offline data initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing offline data:', error);
      throw error;
    }
  }

  // Get unsynced inspections
  async getUnsyncedInspections() {
    const inspections = await this.inspections
      .where('synced')
      .equals(false)
      .toArray();

    // Get photos for each inspection
    for (const inspection of inspections) {
      inspection.photos = await this.photos
        .where('inspectionSyncId')
        .equals(inspection.syncId)
        .sortBy('sequenceOrder');
    }

    return inspections;
  }

  // Mark inspection as synced
  async markInspectionSynced(syncId, serverId) {
    await this.inspections
      .where('syncId')
      .equals(syncId)
      .modify({ synced: true, id: serverId });
  }

  // Create offline inspection
  async createOfflineInspection(inspection) {
    const syncId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const inspectionData = {
      ...inspection,
      syncId,
      synced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const id = await this.inspections.add(inspectionData);
    
    // Add to sync queue
    await this.syncQueue.add({
      type: 'inspection',
      syncId,
      createdAt: new Date().toISOString()
    });

    return { ...inspectionData, id };
  }

  // Save photo offline
  async savePhotoOffline(inspectionSyncId, photoData, caption, sequenceOrder) {
    const syncId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return await this.photos.add({
      syncId,
      inspectionSyncId,
      photo_data: photoData,
      caption,
      sequenceOrder,
      createdAt: new Date().toISOString()
    });
  }

  // Get last sync time
  async getLastSyncTime() {
    const setting = await this.settings.get('lastSync');
    return setting ? setting.value : null;
  }
}

export const db = new LambertDB();
