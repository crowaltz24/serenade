import { useRef, useState, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { X } from 'lucide-react';
import type { Track } from '../electron';

interface QueueModalProps {
  userQueue: Track[];
  shuffleQueue: Track[];
  onClose: () => void;
  currentTrack: Track | null;
  isShuffleOn: boolean;
  onRemoveFromQueue: (index: number) => void;
  onAddToQueue: (track: Track) => void;
}

const calculateMenuPosition = (e: ReactMouseEvent<HTMLElement>) => {
  const x = e.clientX;
  const y = e.clientY;
  const menuWidth = 160;
  const menuHeight = 48;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const adjustedX = Math.min(x, vw - menuWidth);
  const adjustedY = Math.min(y, vh - menuHeight);
  return { x: adjustedX, y: adjustedY };
};

export default function QueueModal({ 
  userQueue,
  shuffleQueue,
  onClose,
  currentTrack,
  isShuffleOn,
  onRemoveFromQueue,
  onAddToQueue
}: QueueModalProps) {
  const queueListRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: Track;
    index: number;
    queueType: 'user' | 'shuffle';
  } | null>(null);
  const [showAllShuffleQueue, setShowAllShuffleQueue] = useState(false);

  const handleContextMenu = (e: ReactMouseEvent<HTMLElement>, track: Track, index: number, queueType: 'user' | 'shuffle') => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = calculateMenuPosition(e);
    setContextMenu({ x, y, track, index, queueType });
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu]);

  const displayedShuffleQueue = showAllShuffleQueue 
    ? shuffleQueue 
    : shuffleQueue.slice(0, 10);

  return (
    <div 
      className="modal-overlay" 
      onClick={() => {
        setContextMenu(null);  // close context menu first
        onClose();            // then close modal
      }}
    >
      <div 
        className="modal-content queue-modal" 
        onClick={e => {
          e.stopPropagation();
          setContextMenu(null);
        }}
        style={{ maxHeight: '80vh' }}
      >
        <div className="queue-modal-header">
          <h2>Play Queue</h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '8px'
            }}
          >
            <X size={24} />
          </button>
        </div>
        <div 
          ref={queueListRef}
          className="queue-list" 
          style={{ 
            maxHeight: 'calc(80vh - 80px)',
            overflowY: 'auto',
            paddingBottom: '16px'
          }}
        >
          {userQueue.length > 0 && (
            <div className="queue-section">
              <div className="queue-section-header">User Queue</div>
              {userQueue.map((track, index) => (
                <div 
                  key={`user-${track.fullPath}-${index}`}
                  className={`queue-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, track, index, 'user')}
                >
                  <div className="queue-item-info">
                    <div className="queue-item-title">{track.title || track.name}</div>
                    <div className="queue-item-artist">{track.artist || 'Unknown Artist'}</div>
                  </div>
                  <button 
                    className="queue-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromQueue(index);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                      width: '24px',
                      padding: 0
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {shuffleQueue.length > 0 && isShuffleOn && (
            <div className="queue-section">
              <div className="queue-section-header">Shuffle Queue</div>
              {displayedShuffleQueue.map((track, index) => (
                <div 
                  key={`shuffle-${track.fullPath}-${index}`}
                  className={`queue-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, track, index, 'shuffle')}
                >
                  <div className="queue-item-info">
                    <div className="queue-item-title">{track.title || track.name}</div>
                    <div className="queue-item-artist">{track.artist || 'Unknown Artist'}</div>
                  </div>
                  <button 
                    className="queue-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromQueue(userQueue.length + index);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                      width: '24px',
                      padding: 0
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {shuffleQueue.length > 10 && (
                <button
                  className="see-more-btn"
                  onClick={() => setShowAllShuffleQueue(!showAllShuffleQueue)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    textAlign: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {showAllShuffleQueue ? 'Show Less' : `Show ${shuffleQueue.length - 10} More`}
                </button>
              )}
            </div>
          )}
          
          {userQueue.length === 0 && (!isShuffleOn || shuffleQueue.length === 0) && (
            <div className="queue-empty">Queue is empty</div>
          )}
        </div>

        {contextMenu && (
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 9999,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px',
              padding: '4px 0',
              minWidth: '160px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
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
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Add to Queue
            </button>
            <button 
              className="context-menu-item"
              onClick={() => {
                const removeIndex = contextMenu.queueType === 'shuffle' 
                  ? userQueue.length + contextMenu.index
                  : contextMenu.index;
                onRemoveFromQueue(removeIndex);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Remove from Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 