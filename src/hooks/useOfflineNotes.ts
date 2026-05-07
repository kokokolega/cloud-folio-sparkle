import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, OfflineNote } from '@/lib/offlineStorage';
import { offlineSync } from '@/lib/offlineSync';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UseOfflineNotesOptions {
  limit?: number;
  enableOffline?: boolean;
}

export function useOfflineNotes(options: UseOfflineNotesOptions = {}) {
  const { limit = 100, enableOffline = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Online query
  const onlineQuery = useQuery({
    queryKey: ['notes', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Cache results for offline use
      if (enableOffline && data) {
        for (const note of data) {
          await offlineStorage.saveNote({
            ...note,
            isDirty: false,
            lastSynced: new Date().toISOString()
          });
        }
      }
      
      return data;
    },
    enabled: !!user && !isOfflineMode,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Offline query
  const offlineQuery = useQuery({
    queryKey: ['notes-offline', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return offlineStorage.getNotes(user.id, limit);
    },
    enabled: !!user && isOfflineMode,
    staleTime: Infinity,
  });

  // Combined notes
  const notes = isOfflineMode ? offlineQuery.data || [] : onlineQuery.data || [];
  const isLoading = onlineQuery.isLoading || offlineQuery.isLoading;
  const error = onlineQuery.error || offlineQuery.error;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (note: { title: string; content: string; color: string; folder_id?: string | null }) => {
      if (!user) throw new Error('User not authenticated');
      
      const noteData = {
        ...note,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isOfflineMode) {
        // Save to offline storage
        const offlineNote: OfflineNote = {
          ...noteData,
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pinned: false,
          isDirty: true,
        };
        
        await offlineStorage.saveNote(offlineNote);
        await offlineSync.queueNoteOperation('create', noteData);
        
        return offlineNote;
      } else {
        // Save to server
        const { data, error } = await supabase.from('notes').insert(noteData).select().single();
        if (error) throw error;
        
        // Cache for offline
        await offlineStorage.saveNote({
          ...data,
          isDirty: false,
          lastSynced: new Date().toISOString()
        });
        
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notes-offline', user?.id] });
      toast.success(isOfflineMode ? 'Note saved locally' : 'Note created');
    },
    onError: (error: any) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; color?: string; pinned?: boolean }) => {
      if (!user) throw new Error('User not authenticated');
      
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (isOfflineMode) {
        // Update in offline storage
        const existingNote = await offlineStorage.getNote(id);
        if (!existingNote) throw new Error('Note not found');
        
        const updatedNote = { ...existingNote, ...updateData, isDirty: true };
        await offlineStorage.saveNote(updatedNote);
        
        // Queue update operation
        await offlineSync.queueNoteOperation('update', { id, ...updateData });
        
        return updatedNote;
      } else {
        // Update on server
        const { data, error } = await supabase.from('notes').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        
        // Update cache
        await offlineStorage.saveNote({
          ...data,
          isDirty: false,
          lastSynced: new Date().toISOString()
        });
        
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notes-offline', user?.id] });
      toast.success(isOfflineMode ? 'Note updated locally' : 'Note updated');
    },
    onError: (error: any) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');
      
      if (isOfflineMode) {
        // Mark as deleted in offline storage
        const existingNote = await offlineStorage.getNote(id);
        if (!existingNote) throw new Error('Note not found');
        
        const deletedNote = { 
          ...existingNote, 
          deleted_at: new Date().toISOString(),
          isDirty: true 
        };
        
        await offlineStorage.saveNote(deletedNote);
        await offlineSync.queueNoteOperation('delete', { id });
        
        return deletedNote;
      } else {
        // Soft delete on server
        const { error } = await supabase.from('notes').update({ 
          deleted_at: new Date().toISOString() 
        }).eq('id', id);
        
        if (error) throw error;
        
        // Remove from cache
        await offlineStorage.deleteNote(id);
        
        return { id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notes-offline', user?.id] });
      toast.success(isOfflineMode ? 'Note moved to trash locally' : 'Note moved to trash');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  // Auto-save for real-time updates
  const autoSave = useCallback(async (id: string, data: { title: string; content: string; color: string }) => {
    if (!user) return;
    
    try {
      if (isOfflineMode) {
        const existingNote = await offlineStorage.getNote(id);
        if (!existingNote) return;
        
        const updatedNote = { 
          ...existingNote, 
          ...data, 
          isDirty: true,
          updated_at: new Date().toISOString()
        };
        
        await offlineStorage.saveNote(updatedNote);
        await offlineSync.queueNoteOperation('update', { id, ...data });
      } else {
        const { error } = await supabase.from('notes').update(data).eq('id', id);
        if (!error) {
          // Update cache
          const existingNote = await offlineStorage.getNote(id);
          if (existingNote) {
            await offlineStorage.saveNote({
              ...existingNote,
              ...data,
              isDirty: false,
              lastSynced: new Date().toISOString()
            });
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notes-offline', user?.id] });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [user, isOfflineMode, queryClient]);

  // Monitor connection status
  useEffect(() => {
    if (!enableOffline) return;
    
    const unsubscribe = offlineSync.onConnectionChange((isOnline) => {
      setIsOfflineMode(!isOnline);
      
      if (isOnline) {
        // When coming back online, refresh data
        queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      }
    });
    
    return unsubscribe;
  }, [enableOffline, user?.id, queryClient]);

  return {
    notes,
    isLoading,
    error,
    isOfflineMode,
    createMutation,
    updateMutation,
    deleteMutation,
    autoSave,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notes-offline', user?.id] });
    },
  };
}
