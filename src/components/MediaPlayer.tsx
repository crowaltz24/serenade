import { useState, useRef, useEffect } from "react";
import { Play, Pause, Folder, SkipForward, SkipBack, Volume2, VolumeX, X, Shuffle, ChevronUp, ChevronDown } from "lucide-react";
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
        if (audio.src !== safeUrl) {  // Only set src if its different
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

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", () => setCurrentTrack(getNextTrack()));

    // volume bar fill
    document.documentElement.style.setProperty('--volume-percent', `${volume * 100}%`);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", () => setCurrentTrack(getNextTrack()));
    };
  }, [currentTrack]); // dont depend on isplaying

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // ignore if typing in an input element
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
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    return playlist[(currentIndex + 1) % playlist.length];
  };

  const getPrevTrack = () => {
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    return playlist[(currentIndex - 1 + playlist.length) % playlist.length];
  };

  const getRandomTrack = () => {
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * playlist.length);
    } while (randomIndex === currentIndex && playlist.length > 1);
    return playlist[randomIndex];
  };

  const playNext = () => {
    if (isShuffleOn) {
      setCurrentTrack(getRandomTrack());
    } else {
      setCurrentTrack(getNextTrack());
    }
  };

  const playPrevious = () => setCurrentTrack(getPrevTrack());

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      // volume bar update
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

  const refreshPlaylist = async () => {
    if (folderPath) {
      try {
        const files = await window.electron.getFilesInFolder(folderPath);
        
        // update after file load
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
      
      // adjust split if it's less than min width for current split
      if (totalWidth * (splitSizes[0] / 100) < minPaneWidth || 
          totalWidth * (splitSizes[1] / 100) < minPaneWidth) {
        const newSize = (minPaneWidth / totalWidth) * 100;
        setSplitSizes([newSize, 100 - newSize]);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [splitSizes]);

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
        {/* left side - Tracklist */}
        <div className="h-full">
          {playlist.length > 0 ? (
            <Tracklist 
              playlist={playlist}
              currentTrack={currentTrack}
              onTrackSelect={(track) => {
                setCurrentTrack(track);
                setIsPlaying(true);
              }}
              onFolderSelect={selectFolder}
              folderPath={folderPath}
              onRefresh={refreshPlaylist}
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

        {/* right side - Download */}
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
              {/* track info wala */}
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

              {/* progress bar */}
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
                  >
                    <Shuffle />
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

      {/* Album art modal */}
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
    </div>
  );
}