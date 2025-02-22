import { useState, useEffect } from 'react';
import { type Track } from './MediaPlayer';
import { Folder, RefreshCw, ArrowUp } from 'lucide-react';

interface TracklistProps {
  playlist: Track[];
  currentTrack: Track | null;
  onTrackSelect: (track: Track) => void;
  onFolderSelect: () => void;
  folderPath: string;
  onRefresh: () => void;
  onAddToQueue: (track: Track) => void;
  tracklistRef: React.RefObject<HTMLDivElement | null>;
  currentTrackRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  showJumpToCurrentButton: boolean;
  onJumpToCurrentClick: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  track: Track;
}

export default function Tracklist({ 
  playlist, 
  currentTrack, 
  onTrackSelect, 
  onFolderSelect, 
  folderPath, 
  onRefresh,
  onAddToQueue,
  tracklistRef,
  currentTrackRef,
  onScroll,
  showJumpToCurrentButton,
  onJumpToCurrentClick
}: TracklistProps) {
  const [trackDurations, setTrackDurations] = useState<{[key: string]: number}>({});
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    // Load durations for all tracks
    playlist.forEach(async (track) => {
      const audio = new Audio(await window.electron.getFileUrl(track.fullPath));
      audio.addEventListener('loadedmetadata', () => {
        setTrackDurations(prev => ({
          ...prev,
          [track.fullPath]: audio.duration
        }));
      });
    });
  }, [playlist]);

  const folderName = folderPath.split('/').pop() || '';

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    
    const x = e.pageX;
    const y = e.pageY;
    
    // get viewport dimensions
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    
    const menuWidth = 160;
    const menuHeight = 40;
    
    const adjustedX = Math.min(x, vw - menuWidth - 10);
    const adjustedY = Math.min(y, vh - menuHeight - 10);
    
    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      track
    });
  };


  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && !(e.target as Element).closest('.context-menu')) {
        setContextMenu(null);
      }
    };

    const handleScroll = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu]);

  return (
    <div className="tracklist-container">
      <div className="tracklist-header">
        <h2 className="tracklist-title">Tracklist</h2>
        <div className="tracklist-actions">
          {folderPath && <span className="folder-name">{folderName}</span>}
          <button onClick={onRefresh} className="refresh-btn" title="Refresh tracklist">
            <RefreshCw size={16} />
          </button>
          <button onClick={onFolderSelect} className="change-folder-btn">
            <Folder size={16} />
            Change Folder
          </button>
        </div>
      </div>
      <div 
        className="tracklist" 
        ref={tracklistRef}
        onScroll={onScroll}
      >
        {playlist.map((track, index) => (
          <div 
            key={track.fullPath}
            className={`tracklist-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
            onClick={() => onTrackSelect(track)}
            onContextMenu={(e) => handleContextMenu(e, track)}
            ref={currentTrack?.fullPath === track.fullPath ? currentTrackRef : null}
          >
            <span className="track-number">{index + 1}</span>
            <div className="track-info-compact">
              <div className="track-title">{track.title || track.name}</div>
              <div className="track-artist-small">{track.artist || 'Unknown Artist'}</div>
            </div>
            <div className="track-duration">
              {trackDurations[track.fullPath] 
                ? `${Math.floor(trackDurations[track.fullPath] / 60)}:${String(Math.floor(trackDurations[track.fullPath] % 60)).padStart(2, "0")}`
                : '--:--'
              }
            </div>
          </div>
        ))}
      </div>

      {/* Add Jump to Current button */}
      {showJumpToCurrentButton && currentTrack && (
        <button 
          className="jump-to-current-btn"
          onClick={onJumpToCurrentClick}
          title="Jump to current track"
        >
          <ArrowUp size={16} />
          <span>Current Track</span>
        </button>
      )}

      {/* Update the context menu JSX */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="context-menu-item"
            onClick={() => {
              onAddToQueue(contextMenu.track);
              setContextMenu(null);
            }}
          >
            Add to Queue
          </button>
        </div>
      )}
    </div>
  );
} 