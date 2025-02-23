import { useState, useEffect, MouseEvent as ReactMouseEvent, useMemo, useCallback } from 'react';
import type { Track } from '../electron';
import { Folder, RefreshCw, Music, Search, X, ArrowUpDown, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// sort options
interface SortOption {
  label: string;
  value: 'custom' | 'title-asc' | 'title-desc' | 'duration-asc' | 'duration-desc';
}

interface TracklistProps {
  playlist: Track[];
  currentTrack: Track | null;
  onTrackSelect: (track: Track) => void;
  onFolderSelect: () => void;
  folderPath: string;
  onRefresh: () => void;
  onAddToQueue: (track: Track) => void;
  tracklistRef: React.RefObject<HTMLDivElement>;
  currentTrackRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  showJumpToCurrentButton: boolean;
  onJumpToCurrentClick: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  track: Track;
}

// helper function
const calculateMenuPosition = (e: ReactMouseEvent<HTMLDivElement>) => {
  const x = e.clientX;
  const y = e.clientY - 50;
  
  const menuWidth = 160;
  const menuHeight = 40;
  
  // viewport dimensions
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  const adjustedX = Math.min(x, vw - menuWidth);
  const adjustedY = Math.max(40, Math.min(y, vh - menuHeight));
  
  return { x: adjustedX, y: adjustedY };
};

const sortOptions: SortOption[] = [
  { label: 'Custom Order', value: 'custom' },
  { label: 'Title (A-Z)', value: 'title-asc' },
  { label: 'Title (Z-A)', value: 'title-desc' },
  { label: 'Duration (Shortest)', value: 'duration-asc' },
  { label: 'Duration (Longest)', value: 'duration-desc' },
];

interface SortableTrackItemProps {
  track: Track;
  index: number;
  isActive: boolean;
  onContextMenu: (e: ReactMouseEvent<HTMLDivElement>, track: Track) => void;
  onSelect: (track: Track) => void;
  duration: number;
  currentTrackRef?: React.RefObject<HTMLDivElement>;
  currentSort: SortOption['value'];
}

const SortableTrackItem = ({ 
  track, 
  index, 
  isActive, 
  onContextMenu, 
  onSelect,
  duration,
  currentTrackRef,
  currentSort
}: SortableTrackItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: track.fullPath,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)'
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 1000 : isActive ? 2 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (isActive && currentTrackRef && node) {
          currentTrackRef.current = node;
        }
      }}
      style={style}
      className={`tracklist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(track)}
      onContextMenu={(e) => onContextMenu(e, track)}
      {...attributes}
    >
      {currentSort === 'custom' && (
        <div 
          className="drag-handle"
          {...listeners}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <GripVertical />
        </div>
      )}
      <span className="track-number">{index + 1}</span>
      <div className="track-info-compact">
        <div className="track-title">{track.title || track.name}</div>
        <div className="track-artist-small">{track.artist || 'Unknown Artist'}</div>
      </div>
      <div className="track-duration">
        {duration 
          ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`
          : '--:--'
        }
      </div>
    </div>
  );
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption['value']>('custom');
  const [orderedTracks, setOrderedTracks] = useState<Track[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
        delay: 0,
        tolerance: 1,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
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


  useEffect(() => {
    const initializeTrackOrder = async () => {
      // always start with the current playlist as base
      setOrderedTracks(playlist);
      
      if (folderPath && window.electron?.getTrackOrder) {
        try {
          const savedOrder = await window.electron.getTrackOrder(folderPath);
          
          if (savedOrder && savedOrder.length > 0) {

            // map of the current playlist for lookup
            const trackMap = new Map(playlist.map(track => [track.fullPath, track]));
            
            const validOrderedTracks = savedOrder
              .filter(path => trackMap.has(path))
              .map(path => trackMap.get(path)!);
            
            const newTracks = playlist.filter(track => 
              !savedOrder.includes(track.fullPath)
            );
            
            // ordered tracks + new tracks
            setOrderedTracks([...validOrderedTracks, ...newTracks]);
          }
        } catch (error) {
          console.error('Failed to load track order:', error);
        }
      }
    };

    initializeTrackOrder();
  }, [folderPath, playlist]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = orderedTracks.findIndex(track => track.fullPath === active.id);
      const newIndex = orderedTracks.findIndex(track => track.fullPath === over.id);
      
      const newOrder = [...orderedTracks];
      const [movedItem] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedItem);
      
      setOrderedTracks(newOrder);
      
      // save new order
      if (window.electron?.saveTrackOrder) {
        try {
          await window.electron.saveTrackOrder(
            folderPath,
            newOrder.map(track => track.fullPath)
          );
        } catch (error) {
          console.error('Failed to save track order:', error);
        }
      }
    }
  }, [orderedTracks, folderPath]);

  // handle empty search
  const filteredPlaylist = useMemo(() => {
    let tracks = orderedTracks.length > 0 ? orderedTracks : playlist;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tracks = tracks.filter(track => 
        (track.title?.toLowerCase() || '').includes(query) ||
        (track.name?.toLowerCase() || '').includes(query) ||
        (track.artist?.toLowerCase() || '').includes(query)
      );
    }

    // only apply sorting if not in custom order mode
    if (currentSort !== 'custom') {
      return [...tracks].sort((a, b) => {
        switch (currentSort) {
          case 'title-desc':
            return (b.title || b.name || '').localeCompare(a.title || a.name || '');
          case 'duration-asc':
            return (trackDurations[a.fullPath] || 0) - (trackDurations[b.fullPath] || 0);
          case 'duration-desc':
            return (trackDurations[b.fullPath] || 0) - (trackDurations[a.fullPath] || 0);
          default: // title-asc
            return (a.title || a.name || '').localeCompare(b.title || b.name || '');
        }
      });
    }

    return tracks;
  }, [orderedTracks, playlist, searchQuery, currentSort, trackDurations]);

  return (
    <div className="tracklist-container">
      <div className="tracklist-header">
        <div className="tracklist-title">Tracklist</div>
        <div className="tracklist-controls">
          {folderPath && <span className="folder-name">{folderName}</span>}
          <div className="sort-container">
            <button 
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="control-btn"
            >
              <ArrowUpDown size={16} />
            </button>
            {showSortMenu && (
              <div className="sort-menu">
                {sortOptions.map(option => (
                  <button
                    key={option.value}
                    className={`sort-option ${currentSort === option.value ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentSort(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {/* search input */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="clear-search-btn"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={currentSort === 'custom' ? handleDragEnd : undefined}
        onDragStart={currentSort === 'custom' ? () => {
          if (window.navigator.vibrate) {
            window.navigator.vibrate(50);
          }
        } : undefined}
        modifiers={[restrictToVerticalAxis]}
      >
        <div 
          className="tracklist" 
          ref={tracklistRef}
          onScroll={onScroll}
        >
          <SortableContext
            items={filteredPlaylist.map(track => track.fullPath)}
            strategy={verticalListSortingStrategy}
          >
            {filteredPlaylist.map((track, index) => (
              <SortableTrackItem
                key={track.fullPath}
                track={track}
                index={index}
                isActive={currentTrack?.fullPath === track.fullPath}
                onContextMenu={handleContextMenu}
                onSelect={onTrackSelect}
                duration={trackDurations[track.fullPath] || 0}
                currentTrackRef={currentTrack?.fullPath === track.fullPath ? 
                  (currentTrackRef as React.RefObject<HTMLDivElement>) : 
                  undefined}
                currentSort={currentSort}
              />
            ))}
          </SortableContext>

          {filteredPlaylist.length === 0 && (
            <div className="no-results">
              No tracks found for "{searchQuery}"
            </div>
          )}
        </div>
      </DndContext>

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