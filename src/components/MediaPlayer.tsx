import { useState, useRef, useEffect } from "react";
import { Play, Pause, Folder, SkipForward, SkipBack, Volume2, VolumeX, X, Shuffle, ChevronUp, ChevronDown, List} from "lucide-react";
import Split from 'react-split';
import Tracklist from './Tracklist';
import Download from './Download';

export type Track = {
  fullPath: string;
  name: string;
  artist?: string;
  title?: string;
  albumArt?: {
    format: string;
    data: string;
  } | null;
};

export default function MediaPlayer() {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  const audioRef = useRef(new Audio());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const DEFAULT_ALBUM_ART = '/default-album.png';
  const [isMinimized, setIsMinimized] = useState(false);
  const [folderPath, setFolderPath] = useState<string>('');
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tempProgress, setTempProgress] = useState(0);
  const [splitSizes, setSplitSizes] = useState([50, 50]);
  const [playHistory, setPlayHistory] = useState<Track[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [userQueue, setUserQueue] = useState<Track[]>([]);
  const [shuffleQueue, setShuffleQueue] = useState<Track[]>([]);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [showJumpToCurrentButton, setShowJumpToCurrentButton] = useState(false);
  const currentTrackRef = useRef<HTMLDivElement>(null);
  const tracklistRef = useRef<HTMLDivElement>(null);

  const getFileName = (filePath: string) => {
    const fileNameWithExt = filePath.split(/[\\/]/).pop() || filePath;
    return fileNameWithExt.replace(/\.[^/.]+$/, "");
  };

  const selectFolder = async () => {
    if (window.electron?.selectFolder) {
      const files = await window.electron.selectFolder();
      if (files.length > 0) {
        const folderPath = files[0].split(/[\\/]/).slice(0, -1).join('/');
        setFolderPath(folderPath);
        
        const formattedFiles = await Promise.all(files.map(async (file: string) => {
          try {
            const metadata = await window.electron.getMetadata(file);
            console.log('Metadata received for file:', file);
            console.log('Album art:', metadata?.albumArt ? {
              format: metadata.albumArt.format,
              dataLength: metadata.albumArt.data.length
            } : 'None');
            
            return {
              fullPath: file,
              name: metadata?.title || getFileName(file),
              artist: metadata?.artist || '',
              title: metadata?.title || getFileName(file),
              albumArt: metadata?.albumArt
            };
          } catch (error) {
            console.error('Error processing file:', file, error);
            return {
              fullPath: file,
              name: getFileName(file),
              artist: '',
              title: getFileName(file),
              albumArt: null
            };
          }
        }));
        
        console.log('First track album art:', formattedFiles[0].albumArt ? {
          format: formattedFiles[0].albumArt.format,
          dataLength: formattedFiles[0].albumArt.data.length
        } : 'None');
        
        setPlaylist(formattedFiles);
        setCurrentTrack(formattedFiles[0]);
      }
    } else {
      console.error("Electron API not available");
    }
  };

  const togglePlay = async () => {
    if (!currentTrack) return;
    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;

    // Only update source if track changes
    if (currentTrack) {
      (async () => {
        const safeUrl = await window.electron.getFileUrl(currentTrack.fullPath);
        if (audio.src !== safeUrl) {
          audio.src = safeUrl;
          if (isPlaying) audio.play();
        }
      })();
    }

    const updateProgress = () => {
      setProgress(audio.currentTime);
      const progressPercent = (audio.currentTime / (audio.duration || 1));
      document.documentElement.style.setProperty('--progress-percent', progressPercent.toString());
    };
    const updateDuration = () => setDuration(audio.duration || 1);
    const handleTrackEnd = () => playNext();  // use playNext instead of directly setting currentTrack

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleTrackEnd);

    // volume bar fill
    document.documentElement.style.setProperty('--volume-percent', `${volume * 100}%`);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [currentTrack]); // dont depend on isplaying

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if typing in an input element
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentTrack, isPlaying]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    setTempProgress(newTime);
    if (!isDragging) {
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
    audioRef.current.currentTime = tempProgress;
    setProgress(tempProgress);
  };

  const getNextTrack = () => {
    // check user queue (priority)
    if (userQueue.length > 0) {
      const nextTrack = userQueue[0];
      setUserQueue(prev => prev.slice(1));
      return nextTrack;
    }
    
    // Then check shuffle queue
    if (shuffleQueue.length > 0) {
      const nextTrack = shuffleQueue[0];
      setShuffleQueue(prev => prev.slice(1));
      return nextTrack;
    }
    
    // If both queues are empty, get next track from playlist
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    return playlist[(currentIndex + 1) % playlist.length];
  };

  const getPrevTrack = () => {
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    return playlist[(currentIndex - 1 + playlist.length) % playlist.length];
  };

  // const getRandomTrack = () => {
  //   if (!playlist.length) return null;
  //   const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
  //   let randomIndex;
  //   do {
  //     randomIndex = Math.floor(Math.random() * playlist.length);
  //   } while (randomIndex === currentIndex && playlist.length > 1);
  //   return playlist[randomIndex];
  // };

  const updateCurrentTrackWithHistory = (track: Track | null) => {
    if (track) {
      setCurrentTrack(track);
      if (historyIndex === playHistory.length - 1) {
        // keep only the last 10 tracks in history
        setPlayHistory(prev => {
          const newHistory = [...prev, track];
          return newHistory.slice(-10);
        });
        setHistoryIndex(prev => Math.min(prev + 1, 9));
      } else {
        // If we're in the middle of history, truncate forward history
        setPlayHistory(prev => {
          const historySoFar = prev.slice(0, historyIndex + 1);
          const newHistory = [...historySoFar, track];
          return newHistory.slice(-10);
        });
        setHistoryIndex(prev => Math.min(prev + 1, 9));
      }
    }
  };

  const playNext = () => {
    if (isShuffleOn) {
      const nextTrack = getNextTrack();
      updateCurrentTrackWithHistory(nextTrack);
      
      // Ensure shuffle queue stays populated
      if (shuffleQueue.length < 2 && userQueue.length === 0) {
        const remainingTracks = playlist
          .filter(track => 
            track.fullPath !== nextTrack?.fullPath && 
            !userQueue.some(t => t.fullPath === track.fullPath)
          )
          .sort(() => Math.random() - 0.5);
        setShuffleQueue(prev => [...prev, ...remainingTracks]);
      }
    } else {
      updateCurrentTrackWithHistory(getNextTrack());
    }
  };

  const playPrevious = () => {
    if (isShuffleOn && playHistory.length > 0) {
      if (historyIndex > 0) {
        // Go back in history
        setHistoryIndex(prev => prev - 1);
        setCurrentTrack(playHistory[historyIndex - 1]);
      } else {
        // If at the start of history, stay on current track
        setCurrentTrack(playHistory[0]);
      }
    } else {
      // Normal previous behavior when shuffle is off
      setCurrentTrack(getPrevTrack());
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      // Update volume bar fill
      document.documentElement.style.setProperty('--volume-percent', `${newVolume * 100}%`);
    }
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (isMuted) {
      audio.volume = previousVolume;
      setVolume(previousVolume);
    } else {
      setPreviousVolume(volume);
      audio.volume = 0;
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const toggleShuffle = () => {
    setIsShuffleOn(!isShuffleOn);
    
    if (!isShuffleOn && currentTrack) {
      // When turning shuffle on, shuffle remaining playlist into shuffleQueue
      const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack.fullPath);
      const remainingTracks = playlist.slice(currentIndex + 1);
      const shuffledTracks = [...remainingTracks]
        .sort(() => Math.random() - 0.5)
        .filter(track => track.fullPath !== currentTrack.fullPath);
      
      setShuffleQueue(shuffledTracks);
      setPlayHistory([currentTrack]);
      setHistoryIndex(0);
    } else {
      // When turning shuffle off, clear shuffle queue and restore sequential order
      setShuffleQueue([]);
      const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
      if (currentIndex !== -1) {
        const remainingTracks = playlist.slice(currentIndex + 1);
        // Keep user queue intact, only clear shuffle queue
      }
    }
  };

  const refreshPlaylist = async () => {
    if (folderPath) {
      try {
        // Get all music files from the current folder
        const files = await window.electron.getFilesInFolder(folderPath);
        
        // Process files and update playlist
        const formattedFiles = await Promise.all(files.map(async (file: string) => {
          const metadata = await window.electron.getMetadata(file);
          return {
            fullPath: file,
            name: metadata?.title || getFileName(file),
            artist: metadata?.artist || '',
            title: metadata?.title || getFileName(file),
            albumArt: metadata?.albumArt
          };
        }));
        setPlaylist(formattedFiles);
      } catch (error) {
        console.error('Error refreshing playlist:', error);
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleResize = () => {
      const totalWidth = window.innerWidth;
      const minPaneWidth = 266; // Our minimum pane width
      
      // If current split would make any pane too small, adjust the split
      if (totalWidth * (splitSizes[0] / 100) < minPaneWidth || 
          totalWidth * (splitSizes[1] / 100) < minPaneWidth) {
        const newSize = (minPaneWidth / totalWidth) * 100;
        setSplitSizes([newSize, 100 - newSize]);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [splitSizes]);

  const handleTrackSelect = (track: Track) => {
    if (isShuffleOn) {
      updateCurrentTrackWithHistory(track);
    } else {
      setCurrentTrack(track);
    }
    setIsPlaying(true);
  };

  const removeFromQueue = (indexToRemove: number) => {
    if (indexToRemove < userQueue.length) {
      // Remove from user queue
      setUserQueue(prev => prev.filter((_, index) => index !== indexToRemove));
    } else {
      // Remove from shuffle queue
      const shuffleIndex = indexToRemove - userQueue.length;
      setShuffleQueue(prev => prev.filter((_, index) => index !== shuffleIndex));
    }
  };

  const addToQueue = (track: Track) => {
    setUserQueue(prev => [...prev, track]);
  };

  const QueueModal = ({ 
    userQueue,
    shuffleQueue, 
    onClose, 
    currentTrack 
  }: { 
    userQueue: Track[],
    shuffleQueue: Track[], 
    onClose: () => void,
    currentTrack: Track | null 
  }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content queue-modal" onClick={e => e.stopPropagation()}>
        <div className="queue-modal-header">
          <h2>Play Queue</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="queue-list">
          {userQueue.length > 0 && (
            <div className="queue-section">
              <div className="queue-section-header">User Queue</div>
              {userQueue.map((track, index) => (
                <div 
                  key={`user-${track.fullPath}-${index}`}
                  className={`queue-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
                >
                  <div className="queue-item-info">
                    <div className="queue-item-title">{track.title || track.name}</div>
                    <div className="queue-item-artist">{track.artist || 'Unknown Artist'}</div>
                  </div>
                  <button 
                    className="queue-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(index);
                    }}
                    title="Remove from queue"
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
              {shuffleQueue.map((track, index) => (
                <div 
                  key={`shuffle-${track.fullPath}-${index}`}
                  className={`queue-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
                >
                  <div className="queue-item-info">
                    <div className="queue-item-title">{track.title || track.name}</div>
                    <div className="queue-item-artist">{track.artist || 'Unknown Artist'}</div>
                  </div>
                  <button 
                    className="queue-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(userQueue.length + index);
                    }}
                    title="Remove from queue"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {userQueue.length === 0 && (!isShuffleOn || shuffleQueue.length === 0) && (
            <div className="queue-empty">Queue is empty</div>
          )}
        </div>
      </div>
    </div>
  );

  const handleTracklistScroll = () => {
    if (!currentTrackRef.current || !tracklistRef.current) return;

    const tracklistRect = tracklistRef.current.getBoundingClientRect();
    const currentTrackRect = currentTrackRef.current.getBoundingClientRect();

    // Check if the current track is out of view
    const isOutOfView = 
      currentTrackRect.top < tracklistRect.top || 
      currentTrackRect.bottom > tracklistRect.bottom;

    setShowJumpToCurrentButton(isOutOfView);
    console.log('Jump button visibility:', isOutOfView);
  };

  const scrollToCurrentTrack = () => {
    if (!currentTrackRef.current) return;
    
    currentTrackRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-white relative">
      <h1 className="serenade-title">Serenade</h1>

      <Split 
        className="app-container split"
        sizes={splitSizes}
        minSize={400}
        gutterSize={8}
        snapOffset={30}
        dragInterval={1}
        direction="horizontal"
        expandToMin={true}
        onDragEnd={(sizes) => setSplitSizes(sizes)}
      >
        {/* Left side - Tracklist */}
        <div className="h-full">
          {playlist.length > 0 ? (
            <Tracklist 
              playlist={playlist}
              currentTrack={currentTrack}
              onTrackSelect={handleTrackSelect}
              onFolderSelect={selectFolder}
              folderPath={folderPath}
              onRefresh={refreshPlaylist}
              onAddToQueue={addToQueue}
              tracklistRef={tracklistRef}
              currentTrackRef={currentTrackRef}
              onScroll={handleTracklistScroll}
              showJumpToCurrentButton={showJumpToCurrentButton}
              onJumpToCurrentClick={scrollToCurrentTrack}
            />
          ) : (
            <div className="empty-tracklist">
              <button onClick={selectFolder} className="folder-btn">
                <Folder size={20} />
                Select Music Folder
              </button>
            </div>
          )}
        </div>

        {/* Right side - Download */}
        <div className="h-full">
          <Download 
            tracklistFolder={folderPath} 
            onDownloadComplete={refreshPlaylist}
          />
        </div>
      </Split>

      {/* Player Controls */}
      <div className={`media-controls-container ${isMinimized ? 'minimized' : ''}`}>
        <div className="media-controls-container">
          {isMinimized ? (
            <>
              <div className="playback-controls">
                <button onClick={playPrevious} className="control-btn">
                  <SkipBack />
                </button>
                <button onClick={togglePlay} className="control-btn play-btn">
                  {isPlaying ? <Pause /> : <Play />}
                </button>
                <button onClick={playNext} className="control-btn">
                  <SkipForward />
                </button>
              </div>
              <button 
                className="maximize-btn"
                onClick={() => setIsMinimized(false)}
                title="Maximize player"
              >
                <ChevronUp size={16} />
              </button>
            </>
          ) : (
            <>
              {/* Track Info Section */}
              <div className="track-info">
                <div className="track-image" onClick={toggleModal}>
                  {currentTrack ? (
                    <img 
                      src={currentTrack.albumArt 
                        ? `data:${currentTrack.albumArt.format};base64,${currentTrack.albumArt.data}`
                        : DEFAULT_ALBUM_ART
                      }
                      alt="Album Art"
                      className="album-img"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.log('Image load error, falling back to default');
                        target.src = DEFAULT_ALBUM_ART;
                        target.onerror = null;
                      }}
                    />
                  ) : (
                    <img 
                      src={DEFAULT_ALBUM_ART}
                      alt="Default Album Art"
                      className="album-img"
                    />
                  )}
                </div>
                <div className="track-details">
                  <div className="track-name">
                    {currentTrack?.title || currentTrack?.name || 'No track selected'}
                  </div>
                  <div className="track-artist">
                    {currentTrack?.artist || ''}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full mb-2">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={isDragging ? tempProgress : progress}
                  onChange={handleSeek}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                  onTouchStart={handleSeekStart}
                  onTouchEnd={handleSeekEnd}
                  className="progress-bar"
                />
                <div className="flex justify-between">
                  <div className="text-sm text-gray-400">
                    {Math.floor(progress / 60)}:
                    {String(Math.floor(progress % 60)).padStart(2, "0")}
                  </div>
                  <div className="text-sm text-gray-400">
                    {Math.floor(duration / 60)}:
                    {String(Math.floor(duration % 60)).padStart(2, "0")}
                  </div>
                </div>
              </div>

              <div className="controls-wrapper">
                <div className="media-controls">
                  <div className="playback-controls">
                    <button onClick={playPrevious} className="control-btn">
                      <SkipBack />
                    </button>
                    <button onClick={togglePlay} className="control-btn play-btn">
                      {isPlaying ? <Pause /> : <Play />}
                    </button>
                    <button onClick={playNext} className="control-btn">
                      <SkipForward />
                    </button>
                  </div>
                </div>
                
                <div className="volume-controls">
                  <button 
                    onClick={() => setIsShuffleOn(!isShuffleOn)}
                    className={`control-btn shuffle-btn ${isShuffleOn ? 'active' : ''}`}
                    title="Shuffle"
                  >
                    <Shuffle size={16} />
                  </button>
                  <button 
                    onClick={() => setIsQueueModalOpen(true)} 
                    className="control-btn queue-btn"
                    title="View Queue"
                  >
                    <List size={16} />
                  </button>
                  <button onClick={toggleMute} className="volume-button">
                    {volume === 0 || isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                  />
                  <button 
                    className="minimize-btn"
                    onClick={() => setIsMinimized(true)}
                    title="Minimize player"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && currentTrack && (
        <div className="modal-overlay" onClick={toggleModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={toggleModal}>
              <X size={24} />
            </button>
            <img 
              src={currentTrack.albumArt 
                ? `data:${currentTrack.albumArt.format};base64,${currentTrack.albumArt.data}`
                : DEFAULT_ALBUM_ART
              }
              alt="Album Art"
              className="modal-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.log('Modal image load error, falling back to default');
                target.src = DEFAULT_ALBUM_ART;
                target.onerror = null;
              }}
            />
          </div>
        </div>
      )}

      {/* Add Queue Modal */}
      {isQueueModalOpen && (
        <QueueModal 
          userQueue={userQueue}
          shuffleQueue={shuffleQueue}
          onClose={() => setIsQueueModalOpen(false)}
          currentTrack={currentTrack}
        />
      )}
    </div>
  );
}