// IndexedDB wrapper for offline storage
interface OfflineNote {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  lastSynced?: string;
  isDirty?: boolean;
}

interface OfflineConversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  lastSynced?: string;
  isDirty?: boolean;
}

interface OfflineMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  lastSynced?: string;
  isDirty?: boolean;
}

interface OfflineFile {
  id: string;
  name: string;
  type: string;
  size: number;
  storage_path?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  lastSynced?: string;
  isDirty?: boolean;
}

interface OfflineGroup {
  id: string;
  name: string;
  description?: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lastSynced?: string;
  isDirty?: boolean;
}

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: 'notes' | 'ai_conversations' | 'ai_messages' | 'files' | 'groups';
  data: any;
  timestamp: string;
  retryCount?: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'oltrid-offline';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('user_id', 'user_id', { unique: false });
          notesStore.createIndex('updated_at', 'updated_at', { unique: false });
          notesStore.createIndex('isDirty', 'isDirty', { unique: false });
        }

        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('user_id', 'user_id', { unique: false });
          convStore.createIndex('updated_at', 'updated_at', { unique: false });
          convStore.createIndex('isDirty', 'isDirty', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversation_id', 'conversation_id', { unique: false });
          msgStore.createIndex('created_at', 'created_at', { unique: false });
          msgStore.createIndex('isDirty', 'isDirty', { unique: false });
        }

        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' });
          filesStore.createIndex('user_id', 'user_id', { unique: false });
          filesStore.createIndex('updated_at', 'updated_at', { unique: false });
          filesStore.createIndex('isDirty', 'isDirty', { unique: false });
        }

        if (!db.objectStoreNames.contains('groups')) {
          const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupsStore.createIndex('created_by', 'created_by', { unique: false });
          groupsStore.createIndex('updated_at', 'updated_at', { unique: false });
          groupsStore.createIndex('isDirty', 'isDirty', { unique: false });
        }

        if (!db.objectStoreNames.contains('operations')) {
          const opsStore = db.createObjectStore('operations', { keyPath: 'id' });
          opsStore.createIndex('timestamp', 'timestamp', { unique: false });
          opsStore.createIndex('table', 'table', { unique: false });
        }
      };
    });
  }

  // Notes operations
  async saveNote(note: OfflineNote): Promise<void> {
    if (!this.db) await this.init();
    
    const noteToSave = {
      ...note,
      lastSynced: note.lastSynced || null,
      isDirty: note.isDirty !== undefined ? note.isDirty : true,
      updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.put(noteToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNotes(userId: string, limit = 100): Promise<OfflineNote[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('user_id');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const notes = request.result
          .filter(note => !note.deleted_at)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, limit);
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getNote(id: string): Promise<OfflineNote | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Conversations operations
  async saveConversation(conversation: OfflineConversation): Promise<void> {
    if (!this.db) await this.init();

    const conversationToSave = {
      ...conversation,
      lastSynced: conversation.lastSynced || null,
      isDirty: conversation.isDirty !== undefined ? conversation.isDirty : true,
      updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conversationToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConversations(userId: string, limit = 50): Promise<OfflineConversation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('user_id');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const conversations = request.result
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, limit);
        resolve(conversations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Messages operations
  async saveMessage(message: OfflineMessage): Promise<void> {
    if (!this.db) await this.init();

    const messageToSave = {
      ...message,
      lastSynced: message.lastSynced || null,
      isDirty: message.isDirty !== undefined ? message.isDirty : true,
      created_at: message.created_at || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(messageToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(conversationId: string, limit = 100): Promise<OfflineMessage[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversation_id');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const messages = request.result
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(0, limit);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Queue operations
  async queueOperation(operation: QueuedOperation): Promise<void> {
    if (!this.db) await this.init();

    const operationToQueue = {
      ...operation,
      id: operation.id || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: operation.timestamp || new Date().toISOString(),
      retryCount: operation.retryCount || 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const request = store.put(operationToQueue);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedOperations(table?: string): Promise<QueuedOperation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readonly');
      const store = transaction.objectStore('operations');
      
      let request: IDBRequest;
      if (table) {
        const index = store.index('table');
        request = index.getAll(table);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const operations = request.result
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeQueuedOperation(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Storage management
  async getStorageUsage(): Promise<{ used: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0
      };
    }
    
    // Fallback: estimate based on IndexedDB size
    return new Promise((resolve) => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then((estimate) => {
          resolve({
            used: estimate.usage || 0,
            available: estimate.quota || 0
          });
        });
      } else {
        resolve({ used: 0, available: 0 });
      }
    });
  }

  async cleanupOldData(daysToKeep = 30): Promise<void> {
    if (!this.db) await this.init();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    const stores = ['notes', 'conversations', 'messages', 'files', 'groups'];
    
    for (const storeName of stores) {
      await this.cleanupStore(storeName, cutoffTimestamp);
    }
  }

  private async cleanupStore(storeName: string, cutoffTimestamp: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('updated_at');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTimestamp));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          // Only delete if not dirty (already synced)
          if (!cursor.value.isDirty) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Sync status
  async getDirtyCount(): Promise<number> {
    if (!this.db) await this.init();

    const stores = ['notes', 'conversations', 'messages', 'files', 'groups'];
    let totalDirty = 0;

    for (const storeName of stores) {
      const dirtyCount = await this.getStoreDirtyCount(storeName);
      totalDirty += dirtyCount;
    }

    return totalDirty;
  }

  private async getStoreDirtyCount(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      // We need to manually iterate since isDirty might not be an index in some stores
      const request = store.getAll();
      
      request.onsuccess = () => {
        const dirtyItems = request.result.filter(item => item.isDirty === true);
        resolve(dirtyItems.length);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
export type { OfflineNote, OfflineConversation, OfflineMessage, OfflineFile, OfflineGroup, QueuedOperation };
