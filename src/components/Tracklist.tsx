import { useState, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import type { Track } from '../electron';
import { Folder, RefreshCw, Music } from 'lucide-react';

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

const calculateMenuPosition = (e: ReactMouseEvent<HTMLDivElement>) => {
  const x = e.clientX;
  const y = e.clientY - 50; 
  
  const menuWidth = 160;
  const menuHeight = 40;
  
  
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // adjust position if menu would go off screen
  const adjustedX = Math.min(x, vw - menuWidth);
  const adjustedY = Math.max(40, Math.min(y, vh - menuHeight));
  
  return { x: adjustedX, y: adjustedY };
};

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
    // load durations for all tracks
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

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { x, y } = calculateMenuPosition(e);
    setContextMenu({ x, y, track });
  };

  
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
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
        <div className="tracklist-title">Tracklist</div>
        <div className="tracklist-controls">
          {folderPath && <span className="folder-name">{folderName}</span>}
          <button 
            onClick={onRefresh}
            className="control-btn"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={onFolderSelect} 
            className="control-btn"
          >
            <Folder size={16} />
          </button>
          {showJumpToCurrentButton && (
            <button 
              onClick={onJumpToCurrentClick}
              className="control-btn"
            >
              <Music size={16} />
            </button>
          )}
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

      {contextMenu && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 9999,
            background: 'var(--secondary-bg)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px 0',
            minWidth: '160px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="context-menu-item"
            onClick={() => {
              onAddToQueue(contextMenu.track);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: 'var(--text-light)',
              cursor: 'pointer',
              transition: 'background 0.2s',
              fontSize: '0.9rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            Add to Queue
          </button>
        </div>
      )}
    </div>
  );
} 