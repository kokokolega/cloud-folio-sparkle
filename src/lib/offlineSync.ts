import { offlineStorage, QueuedOperation, OfflineNote, OfflineConversation, OfflineMessage } from './offlineStorage';
import { supabase } from '@/integrations/supabase/client';

// Dynamic import for toast to avoid SSR issues
let toast: any = { success: () => {}, error: () => {}, info: () => {} };
if (typeof window !== 'undefined') {
  import('sonner').then(({ toast: sonnerToast }) => {
    toast = sonnerToast;
  }).catch(() => {});
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

class OfflineSync {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.setupConnectionMonitoring();
    this.setupMessageListeners();
  }

  // Connection monitoring
  private setupConnectionMonitoring(): void {
    const updateOnlineStatus = () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      if (wasOnline !== this.isOnline) {
        this.listeners.forEach(listener => listener(this.isOnline));
        
        if (this.isOnline) {
          console.log('Back online - starting sync');
          this.syncAll().catch(console.error);
        } else {
          console.log('Gone offline');
          toast.error('You\'re offline. Changes will be synced when you\'re back online.');
        }
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial status
    updateOnlineStatus();
  }

  // Message listeners for service worker communication
  private setupMessageListeners(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETED') {
          console.log('Background sync completed');
          this.notifySyncComplete();
        }
      });
    }
  }

  // Public API
  isConnectionOnline(): boolean {
    return this.isOnline;
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  onConnectionChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Sync operations
  async syncAll(): Promise<SyncResult> {
    if (!this.isOnline || this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ['Not online or already syncing'] };
    }

    this.isSyncing = true;
    console.log('Starting offline sync...');

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get all queued operations
      const operations = await offlineStorage.getQueuedOperations();
      console.log(`Found ${operations.length} operations to sync`);

      for (const operation of operations) {
        try {
          await this.processOperation(operation);
          await offlineStorage.removeQueuedOperation(operation.id);
          result.synced++;
        } catch (error) {
          console.error('Failed to process operation:', operation, error);
          result.failed++;
          result.errors.push(`Failed to sync ${operation.table}: ${error}`);
          
          // Update retry count
          operation.retryCount = (operation.retryCount || 0) + 1;
          
          // Remove if too many retries
          if (operation.retryCount >= 3) {
            await offlineStorage.removeQueuedOperation(operation.id);
            result.errors.push(`Removed ${operation.table} operation after 3 failed attempts`);
          } else {
            // Re-queue with updated retry count
            await offlineStorage.queueOperation(operation);
          }
        }
      }

      // Sync dirty data
      await this.syncDirtyData(result);

      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} items successfully`);
      }

    } catch (error) {
      console.error('Sync failed:', error);
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
      toast.error('Sync failed. Some changes may not be saved.');
    } finally {
      this.isSyncing = false;
      console.log('Sync completed:', result);
    }

    return result;
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    const { type, table, data } = operation;

    switch (table) {
      case 'notes':
        await this.syncNoteOperation(type, data);
        break;
      case 'ai_conversations':
        await this.syncConversationOperation(type, data);
        break;
      case 'ai_messages':
        await this.syncMessageOperation(type, data);
        break;
      case 'files':
        await this.syncFileOperation(type, data);
        break;
      case 'groups':
        await this.syncGroupOperation(type, data);
        break;
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }

  private async syncNoteOperation(type: string, data: any): Promise<void> {
    switch (type) {
      case 'create':
        const { error: createError } = await supabase.from('notes').insert(data);
        if (createError) throw createError;
        break;
      case 'update':
        const { id, ...updateData } = data;
        const { error: updateError } = await supabase.from('notes').update(updateData).eq('id', id);
        if (updateError) throw updateError;
        break;
      case 'delete':
        const { error: deleteError } = await supabase.from('notes').delete().eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncConversationOperation(type: string, data: any): Promise<void> {
    switch (type) {
      case 'create':
        const { error: createError } = await supabase.from('ai_conversations').insert(data);
        if (createError) throw createError;
        break;
      case 'update':
        const { id, ...updateData } = data;
        const { error: updateError } = await supabase.from('ai_conversations').update(updateData).eq('id', id);
        if (updateError) throw updateError;
        break;
      case 'delete':
        const { error: deleteError } = await supabase.from('ai_conversations').delete().eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncMessageOperation(type: string, data: any): Promise<void> {
    switch (type) {
      case 'create':
        const { error: createError } = await supabase.from('ai_messages').insert(data);
        if (createError) throw createError;
        break;
      case 'update':
        const { id, ...updateData } = data;
        const { error: updateError } = await supabase.from('ai_messages').update(updateData).eq('id', id);
        if (updateError) throw updateError;
        break;
      case 'delete':
        const { error: deleteError } = await supabase.from('ai_messages').delete().eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncFileOperation(type: string, data: any): Promise<void> {
    // Files are more complex due to storage - for now just sync metadata
    switch (type) {
      case 'create':
      case 'update':
        const { id, ...fileData } = data;
        const { error } = await supabase.from('files').upsert(fileData);
        if (error) throw error;
        break;
      case 'delete':
        const { error: deleteError } = await supabase.from('files').delete().eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncGroupOperation(type: string, data: any): Promise<void> {
    switch (type) {
      case 'create':
        const { error: createError } = await supabase.from('groups').insert(data);
        if (createError) throw createError;
        break;
      case 'update':
        const { id, ...updateData } = data;
        const { error: updateError } = await supabase.from('groups').update(updateData).eq('id', id);
        if (updateError) throw updateError;
        break;
      case 'delete':
        const { error: deleteError } = await supabase.from('groups').delete().eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncDirtyData(result: SyncResult): Promise<void> {
    // Sync dirty notes
    const dirtyNotes = await this.getDirtyNotes();
    for (const note of dirtyNotes) {
      try {
        await this.syncNote(note);
        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to sync note ${note.id}: ${error}`);
      }
    }

    // Sync dirty conversations
    const dirtyConversations = await this.getDirtyConversations();
    for (const conversation of dirtyConversations) {
      try {
        await this.syncConversation(conversation);
        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to sync conversation ${conversation.id}: ${error}`);
      }
    }

    // Sync dirty messages
    const dirtyMessages = await this.getDirtyMessages();
    for (const message of dirtyMessages) {
      try {
        await this.syncMessage(message);
        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to sync message ${message.id}: ${error}`);
      }
    }
  }

  private async getDirtyNotes(): Promise<OfflineNote[]> {
    const notes = await offlineStorage.getNotes('current-user'); // This would need actual user ID
    return notes.filter(note => note.isDirty);
  }

  private async getDirtyConversations(): Promise<OfflineConversation[]> {
    const conversations = await offlineStorage.getConversations('current-user');
    return conversations.filter(conv => conv.isDirty);
  }

  private async getDirtyMessages(): Promise<OfflineMessage[]> {
    // Get all messages and filter dirty ones
    const messages: OfflineMessage[] = [];
    // This would need to be implemented based on conversation IDs
    return messages.filter(msg => msg.isDirty);
  }

  private async syncNote(note: OfflineNote): Promise<void> {
    const { id, user_id, lastSynced, isDirty, ...noteData } = note;
    
    if (note.deleted_at) {
      await supabase.from('notes').delete().eq('id', id);
    } else {
      await supabase.from('notes').upsert({
        id,
        user_id,
        ...noteData,
        updated_at: new Date().toISOString()
      } as any);
    }

    // Mark as synced
    await offlineStorage.saveNote({
      ...note,
      isDirty: false,
      lastSynced: new Date().toISOString()
    });
  }

  private async syncConversation(conversation: OfflineConversation): Promise<void> {
    const { id, user_id, lastSynced, isDirty, ...convData } = conversation;
    
    await supabase.from('ai_conversations').upsert({
      id,
      user_id,
      ...convData,
      updated_at: new Date().toISOString()
    } as any);

    // Mark as synced
    await offlineStorage.saveConversation({
      ...conversation,
      isDirty: false,
      lastSynced: new Date().toISOString()
    });
  }

  private async syncMessage(message: OfflineMessage): Promise<void> {
    const { id, conversation_id, lastSynced, isDirty, ...msgData } = message;
    
    await supabase.from('ai_messages').upsert({
      id,
      conversation_id,
      ...msgData,
      created_at: message.created_at
    } as any);

    // Mark as synced
    await offlineStorage.saveMessage({
      ...message,
      isDirty: false,
      lastSynced: new Date().toISOString()
    });
  }

  private notifySyncComplete(): void {
    toast.info('Background sync completed');
  }

  // Auto-sync management
  startAutoSync(intervalMs = 30000): void {
    this.stopAutoSync();
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll().catch(console.error);
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Manual queue operations
  async queueNoteOperation(type: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const operation: QueuedOperation = {
      id: `note_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      table: 'notes',
      data,
      timestamp: new Date().toISOString()
    };
    
    await offlineStorage.queueOperation(operation);
  }

  async queueMessageOperation(type: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const operation: QueuedOperation = {
      id: `msg_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      table: 'ai_messages',
      data,
      timestamp: new Date().toISOString()
    };
    
    await offlineStorage.queueOperation(operation);
  }

  async getPendingCount(): Promise<number> {
    const operations = await offlineStorage.getQueuedOperations();
    const dirtyCount = await offlineStorage.getDirtyCount();
    return operations.length + dirtyCount;
  }
}

export const offlineSync = new OfflineSync();
export type { SyncResult };
