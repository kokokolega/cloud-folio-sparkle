import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState } from 'react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isOffline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSync?: () => Promise<void>;
  connectionType?: string;
  effectiveType?: string;
  className?: string;
}

export function OfflineIndicator({
  isOnline,
  isOffline,
  pendingSyncCount,
  isSyncing,
  onSync,
  connectionType,
  effectiveType,
  className = "",
}: OfflineIndicatorProps) {
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!onSync) return;
    
    try {
      setSyncError(null);
      await onSync();
    } catch (error) {
      setSyncError(typeof error === 'string' ? error : 'Sync failed');
    }
  };

  const getConnectionColor = () => {
    if (isOffline) return 'bg-red-500';
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'bg-orange-500';
    if (effectiveType === '3g') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getConnectionText = () => {
    if (isOffline) return 'Offline';
    if (effectiveType === 'slow-2g') return 'Very Slow';
    if (effectiveType === '2g') return 'Slow';
    if (effectiveType === '3g') return 'Good';
    if (effectiveType === '4g') return 'Fast';
    return 'Online';
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 border border-border/40">
              <div className={`w-2 h-2 rounded-full ${getConnectionColor()} ${isOnline ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-medium text-foreground">
                {getConnectionText()}
              </span>
              {isOffline && <WifiOff className="h-3 w-3 text-muted-foreground" />}
              {isOnline && <Wifi className="h-3 w-3 text-muted-foreground" />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="space-y-1">
              <p>Connection: {getConnectionText()}</p>
              {connectionType && <p>Type: {connectionType}</p>}
              {effectiveType && <p>Speed: {effectiveType}</p>}
              {isOffline && <p className="text-red-500">No internet connection</p>}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Sync Status */}
        {(pendingSyncCount > 0 || isSyncing) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={!isOnline || isSyncing}
                className={`h-7 px-2 gap-1.5 ${
                  syncError ? 'border-red-500 text-red-500' : ''
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {pendingSyncCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                    {pendingSyncCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="space-y-1">
                {isSyncing ? (
                  <p>Syncing changes...</p>
                ) : (
                  <p>{pendingSyncCount} items to sync</p>
                )}
                {isOnline ? (
                  <p className="text-green-500">Click to sync now</p>
                ) : (
                  <p className="text-red-500">Connect to internet to sync</p>
                )}
                {syncError && (
                  <p className="text-red-500">Error: {syncError}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Offline Mode Badge */}
        {isOffline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Offline Mode
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>App is running offline</p>
              <p>Changes will sync when online</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
