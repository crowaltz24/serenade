import { useState, useRef, useEffect } from "react";
import { Play, Pause, Folder, SkipForward, SkipBack, Volume2, VolumeX, X, Shuffle, ChevronUp, ChevronDown, List, Repeat } from "lucide-react";
import Split from 'react-split';
import Tracklist from './Tracklist';
import Download from './Download';
import QueueModal from './QueueModal';
import type { Track } from '../electron';
import AudioVisualizer from './AudioVisualizer';

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
  // const [isDragging, setIsDragging] = useState(false);
  const [splitSizes, setSplitSizes] = useState([50, 50]);
  const [playHistory, setPlayHistory] = useState<Track[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [userQueue, setUserQueue] = useState<Track[]>([]);
  const [shuffleQueue, setShuffleQueue] = useState<Track[]>([]);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [showJumpToCurrentButton, setShowJumpToCurrentButton] = useState(false);
  const currentTrackRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const tracklistRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const textRef = useRef<HTMLDivElement>(null);
  const [isSeekMuted, setIsSeekMuted] = useState(false);
  const [loopMode, setLoopMode] = useState<'none' | 'track' | 'playlist'>('none');
  const [isContentMinimized, setIsContentMinimized] = useState(false);
  // const [isAudioReady, setIsAudioReady] = useState(false);

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
        await window.electron.saveFolder(folderPath);
        
        const formattedFiles = await Promise.all(files.map(async (file: string) => {
          try {
            const metadata = await window.electron.getMetadata(file);
            const processedMetadata = processMetadata(metadata);
            
            return {
              id: file,
              fullPath: file,
              name: processedMetadata.title || getFileName(file),
              artist: processedMetadata.artist,
              artists: processedMetadata.artists,
              title: processedMetadata.title || getFileName(file),
              albumArt: processedMetadata.albumArt
            };
          } catch (error) {
            console.error('Error processing file:', file, error);
            return {
              id: file,
              fullPath: file,
              name: getFileName(file),
              artist: '',
              title: getFileName(file),
              albumArt: null
            };
          }
        }));
        
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

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        // pending pause?
        await new Promise(resolve => setTimeout(resolve, 0));
        await audio.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    audio.id = 'main-audio-element';  // ID for easy find
    audio.crossOrigin = 'anonymous';
    document.body.appendChild(audio);

    if (currentTrack) {
      (async () => {
        const safeUrl = await window.electron.getFileUrl(currentTrack.fullPath);
        if (audio.src !== safeUrl) {
          const wasPlaying = !audio.paused;
          audio.pause();
          audio.src = safeUrl;
          if (wasPlaying) {
            try {
              await new Promise(resolve => setTimeout(resolve, 0));
              await audio.play();
            } catch (error) {
              console.error('Error playing audio:', error);
            }
          }
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

    document.documentElement.style.setProperty('--volume-percent', `${volume * 100}%`);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      document.body.removeChild(audio);
    };
  }, [currentTrack]);

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

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) togglePlay();
      });
      
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) togglePlay();
      });
      
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
      });
      
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });

      // update metadata when track changes
      if (currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || currentTrack.name,
          artist: currentTrack.artists?.join(', ') || currentTrack.artist || '',
          artwork: currentTrack.albumArt ? [
            {
              src: `data:${currentTrack.albumArt.format};base64,${currentTrack.albumArt.data}`,
              sizes: '512x512',
              type: currentTrack.albumArt.format
            }
          ] : undefined
        });
      }
    }
  }, [currentTrack, isPlaying]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    
    // TEMP MUTE AUDIO DURING SEEK
    if (!isSeekMuted) {
      setIsSeekMuted(true);
      audioRef.current.muted = true;
    }
    
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
    const progressPercent = (newTime / (duration || 1));
    document.documentElement.style.setProperty('--progress-percent', progressPercent.toString());

    // DELAY FOR UNMUTE
    clearTimeout((window as any).seekTimeout);
    (window as any).seekTimeout = setTimeout(() => {
      setIsSeekMuted(false);
      audioRef.current.muted = false;
    }, 200);
  };

  const getNextTrack = () => {
    // check user queue (FIRST priority)
    if (userQueue.length > 0) {
      const nextTrack = userQueue[0];
      setUserQueue(prev => prev.slice(1));
      return nextTrack;
    }
    
    // THEN shuffle queue
    if (shuffleQueue.length > 0) {
      const nextTrack = shuffleQueue[0];
      setShuffleQueue(prev => prev.slice(1));
      return nextTrack;
    }
    
    // If both empty, get next track from playlist
    if (!playlist.length) return null;
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
    return playlist[(currentIndex + 1) % playlist.length];
  };

  const getPrevTrack = async () => {
    if (!playlist.length || !currentTrack) return null;
  
    // custom order??
    try {
      const savedOrder = await window.electron.getTrackOrder(folderPath);
      if (savedOrder && savedOrder.length > 0) {
        const currentIndex = savedOrder.indexOf(currentTrack.fullPath);
        if (currentIndex > -1) {
          const prevPath = savedOrder[(currentIndex - 1 + savedOrder.length) % savedOrder.length];
          return playlist.find(track => track.fullPath === prevPath) || null;
        }
      }
    } catch (error) {
      console.error('Error getting track order:', error);
    }
    
    // else fall back to directory order
    const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack.fullPath);
    return playlist[(currentIndex - 1 + playlist.length) % playlist.length];
  };

  const updateCurrentTrackWithHistory = (track: Track | null) => {
    if (track) {
      setCurrentTrack(track);
      if (historyIndex === playHistory.length - 1) {
        // keeps only the last 10 tracks in history
        setPlayHistory(prev => {
          const newHistory = [...prev, track];
          return newHistory.slice(-10);
        });
        setHistoryIndex(prev => Math.min(prev + 1, 9));
      } else {
        setPlayHistory(prev => {
          const historySoFar = prev.slice(0, historyIndex + 1);
          const newHistory = [...historySoFar, track];
          return newHistory.slice(-10);
        });
        setHistoryIndex(prev => Math.min(prev + 1, 9));
      }
    }
  };

  const playNext = async () => {
    let nextTrack: Track | null;
    if (isShuffleOn) {
      nextTrack = getNextTrack();
      updateCurrentTrackWithHistory(nextTrack);
      
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
      nextTrack = getNextTrack();
      updateCurrentTrackWithHistory(nextTrack);
    }

    // If we were playing, continue playing the next track
    if (isPlaying && nextTrack) {
      try {
        await new Promise(resolve => setTimeout(resolve, 0));
        await audioRef.current.play();
      } catch (error) {
        console.error('Error playing next track:', error);
      }
    }
  };

  const playPrevious = async () => {
    let prevTrack;
    if (isShuffleOn && playHistory.length > 0) {
      if (historyIndex > 0) {
        setHistoryIndex(prev => prev - 1);
        prevTrack = playHistory[historyIndex - 1];
        setCurrentTrack(prevTrack);
      } else {
        prevTrack = playHistory[0];
        setCurrentTrack(prevTrack);
      }
    } else {
      prevTrack = await getPrevTrack();
      if (prevTrack) {
        setCurrentTrack(prevTrack);
      }
    }

    // If we were playing, continue playing the previous track
    if (isPlaying && prevTrack) {
      try {
        await new Promise(resolve => setTimeout(resolve, 0));
        await audioRef.current.play();
      } catch (error) {
        console.error('Error playing previous track:', error);
      }
    }
  };

  const handleVolumeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      document.documentElement.style.setProperty('--volume-percent', `${newVolume * 100}%`);
    }
    await window.electron.saveVolume(newVolume);
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (isMuted) {
      audio.volume = previousVolume;
      setVolume(previousVolume);
      document.documentElement.style.setProperty('--volume-percent', `${previousVolume * 100}%`);
    } else {
      setPreviousVolume(volume);
      audio.volume = 0;
      setVolume(0);
      document.documentElement.style.setProperty('--volume-percent', '0%');
    }
    setIsMuted(!isMuted);
  };

  const toggleShuffle = () => {
    setIsShuffleOn(!isShuffleOn);
    
    if (!isShuffleOn && currentTrack) {
      // shuffle remaining tracks into shuffle queue
      const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack.fullPath);
      const remainingTracks = playlist.slice(currentIndex + 1);
      const shuffledTracks = [...remainingTracks]
        .sort(() => Math.random() - 0.5)
        .filter(track => track.fullPath !== currentTrack.fullPath);
      
      setShuffleQueue(shuffledTracks);
      setPlayHistory([currentTrack]);
      setHistoryIndex(0);
    } else {
      // clear shuffle queue and restore sequential order
      setShuffleQueue([]);
    }
  };

  const refreshPlaylist = async () => {
    if (folderPath) {
      try {
        // Get ALL music files from the current folder
        const files = await window.electron.getFilesInFolder(folderPath);
        
        // process files and update playlist
        const formattedFiles = await Promise.all(files.map(async (file: string) => {
          try {
            const metadata = await window.electron.getMetadata(file);
            const processedMetadata = processMetadata(metadata);
            
            return {
              id: file,
              fullPath: file,
              name: processedMetadata.title || getFileName(file),
              artist: processedMetadata.artist,
              artists: processedMetadata.artists,
              title: processedMetadata.title || getFileName(file),
              albumArt: processedMetadata.albumArt
            };
          } catch (error) {
            console.error('Error processing file:', file, error);
            return {
              id: file,
              fullPath: file,
              name: getFileName(file),
              artist: '',
              title: getFileName(file),
              albumArt: null
            };
          }
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
      
      // if current split makes any pane too small, adjust the split
      if (totalWidth * (splitSizes[0] / 100) < minPaneWidth || 
          totalWidth * (splitSizes[1] / 100) < minPaneWidth) {
        const newSize = (minPaneWidth / totalWidth) * 100;
        setSplitSizes([newSize, 100 - newSize]);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [splitSizes]);

  const handleTrackSelect = async (track: Track) => {
    try {
      if (isShuffleOn) {
        updateCurrentTrackWithHistory(track);
      } else {
        setCurrentTrack(track);
      }
      if (isPlaying) {
        await new Promise(resolve => setTimeout(resolve, 0)); // play immediately if already plying
        await audioRef.current.play();
      }
      setIsPlaying(true);
    } catch (error) {
      console.error('Error selecting track:', error);
    }
  };

  const removeFromQueue = (indexToRemove: number) => {
    if (indexToRemove < userQueue.length) {
      // remove from user queue
      setUserQueue(prev => prev.filter((_, index) => index !== indexToRemove));
    } else {
      // remove from shuffle queue
      const shuffleIndex = indexToRemove - userQueue.length;
      setShuffleQueue(prev => prev.filter((_, index) => index !== shuffleIndex));
    }
  };

  const addToQueue = (track: Track) => {
    setUserQueue(prev => [...prev, track]);
  };

  const handleTracklistScroll = () => {
    if (!currentTrackRef.current || !tracklistRef.current) return;

    const tracklistRect = tracklistRef.current.getBoundingClientRect();
    const currentTrackRect = currentTrackRef.current.getBoundingClientRect();

    const isOutOfView = 
      currentTrackRect.top < tracklistRect.top || 
      currentTrackRect.bottom > tracklistRect.bottom;

    setShowJumpToCurrentButton(isOutOfView);
  };

  const scrollToCurrentTrack = () => {
    if (!currentTrackRef.current) return;
    
    currentTrackRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  // const debugAlbumArt = (track: Track | null) => {
  //   if (track?.albumArt) {
  //     console.log('Album art debug:', {
  //       format: track.albumArt.format,
  //       dataLength: track.albumArt.data.length,
  //       dataPreview: track.albumArt.data.substring(0, 50) + '...'
  //     });
  //   } else {
  //     console.log('No album art available for track');
  //   }
  // };

  useEffect(() => {
    const img = new Image();
    img.onerror = () => {
      console.error('Default album art not found at:', DEFAULT_ALBUM_ART);
    };
    img.src = DEFAULT_ALBUM_ART;
  }, []);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const element = textRef.current;
        
        element.classList.remove('overflow');
        void element.offsetWidth;
        
        // if text is overflowing
        const isOverflowing = element.scrollWidth > (element.parentElement?.clientWidth || 0);
        if (isOverflowing) {
          element.classList.add('overflow');
        }
      }
    };

    // check on track change
    checkOverflow();

    // CHECK AFTER DELAY IF PROPERLY RENDERED
    const timeoutId = setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [currentTrack]);

  const processMetadata = (metadata: any) => {
    return {
      title: metadata?.title || '',
      artist: metadata?.artist || '',
      artists: metadata?.artists,
      albumArt: metadata?.albumArt
    };
  };

  useEffect(() => {
    const loadSavedSettings = async () => {
      const savedFolder = await window.electron.getSavedFolder();
      if (savedFolder) {
        setFolderPath(savedFolder);
        const files = await window.electron.getFilesInFolder(savedFolder);
        
        // get saved track order first
        const savedOrder = await window.electron.getTrackOrder(savedFolder);
        
        const formattedFiles = await Promise.all(files.map(async (file: string) => {
          try {
            const metadata = await window.electron.getMetadata(file);
            const processedMetadata = processMetadata(metadata);
            
            return {
              id: file,
              fullPath: file,
              name: processedMetadata.title || getFileName(file),
              artist: processedMetadata.artist,
              artists: processedMetadata.artists,
              title: processedMetadata.title || getFileName(file),
              albumArt: processedMetadata.albumArt
            };
          } catch (error) {
            console.error('Error processing file:', file, error);
            return {
              id: file,
              fullPath: file,
              name: getFileName(file),
              artist: '',
              title: getFileName(file),
              albumArt: null
            };
          }
        }));
        
        setPlaylist(formattedFiles);
        
        if (formattedFiles.length > 0) {
          // If exists a saved order, use first track from it
          if (savedOrder && savedOrder.length > 0) {
            const firstOrderedTrack = formattedFiles.find(track => 
              track.fullPath === savedOrder[0]
            );
            setCurrentTrack(firstOrderedTrack || formattedFiles[0]);
          } else {
            setCurrentTrack(formattedFiles[0]);
          }
        }
      }

      // saved volume
      const savedVolume = await window.electron.getSavedVolume();
      setVolume(savedVolume);
      if (audioRef.current) {
        audioRef.current.volume = savedVolume;
      }
      document.documentElement.style.setProperty('--volume-percent', `${savedVolume * 100}%`);
    };

    loadSavedSettings();
  }, []);

  useEffect(() => {
    const handleFolderSelected = async (event: any) => {
      const { folderPath, files } = event.detail;
      setFolderPath(folderPath);
      await window.electron.saveFolder(folderPath);
      
      const formattedFiles = await Promise.all(files.map(async (file: string) => {
        try {
          const metadata = await window.electron.getMetadata(file);
          const processedMetadata = processMetadata(metadata);
          
          return {
            id: file,
            fullPath: file,
            name: processedMetadata.title || getFileName(file),
            artist: processedMetadata.artist,
            artists: processedMetadata.artists,
            title: processedMetadata.title || getFileName(file),
            albumArt: processedMetadata.albumArt
          };
        } catch (error) {
          console.error('Error processing file:', file, error);
          return {
            id: file,
            fullPath: file,
            name: getFileName(file),
            artist: '',
            title: getFileName(file),
            albumArt: null
          };
        }
      }));
      
      setPlaylist(formattedFiles);
      if (formattedFiles.length > 0) {
        setCurrentTrack(formattedFiles[0]);
      }
    };

    window.addEventListener('folder-selected', handleFolderSelected);
    return () => window.removeEventListener('folder-selected', handleFolderSelected);
  }, []);



  const toggleLoop = () => {
    setLoopMode(current => {
      switch (current) {
        case 'none': return 'track';
        case 'track': return 'playlist';
        case 'playlist': return 'none';
      }
    });
  };

  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTrackEnd = () => {
      if (loopMode === 'track') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else if (loopMode === 'playlist') {
        playNext();
      } else {
        const currentIndex = playlist.findIndex(track => track.fullPath === currentTrack?.fullPath);
        if (currentIndex < playlist.length - 1) {
          playNext();
        }
      }
    };

    audio.addEventListener("ended", handleTrackEnd);
    return () => {
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [loopMode, currentTrack, playlist]);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    setIsContentMinimized(!isContentMinimized);
  };

  useEffect(() => {
    const audio = audioRef.current;
    
    const handleCanPlay = () => {
      // setIsAudioReady(true);
    };

    audio.addEventListener('canplay', handleCanPlay);
    
    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 text-white relative">
      <h1 className="serenade-title">Serenade</h1>

      <div className={`visualizer-placeholder ${isContentMinimized ? 'visible' : ''}`}>
        <AudioVisualizer 
          isPlaying={isPlaying}
          currentTrack={currentTrack}
        />
      </div>

      <div className={`content-wrapper ${isContentMinimized ? 'minimized' : ''}`}>
        <Split 
          className="app-container split"
          sizes={splitSizes}
          minSize={400}
          gutterSize={8}
          gutterStyle={() => ({
            height: 'calc(100% - 14rem)',
            marginBottom: '14rem',
            marginTop: '60px'
          })}
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

          {/* right side - Download */}
          <div className="h-full">
            <Download 
              tracklistFolder={folderPath} 
              onDownloadComplete={refreshPlaylist}
            />
          </div>
        </Split>
      </div>

      {/* player controls */}
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
                onClick={toggleMinimize}
              >
                <ChevronUp size={16} />
              </button>
            </>
          ) : (
            <>
              {/* track info section */}
              <div className="track-info">
                <div className="track-image" onClick={toggleModal}>
                  {currentTrack?.albumArt ? (
                    <img 
                      src={`data:${currentTrack.albumArt.format};base64,${currentTrack.albumArt.data.replace(/[^A-Za-z0-9+/=]/g, '')}`}
                      alt="Album Art"
                      className="album-img"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
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
                    <div 
                      ref={textRef}
                      className="track-name-inner"
                    >
                      {currentTrack?.title || currentTrack?.name || 'No track selected'}
                    </div>
                  </div>
                  <div 
                    className="track-artist"
                    title={currentTrack?.artists?.join(', ') || currentTrack?.artist || ''}
                  >
                    {currentTrack?.artists ? (
                      currentTrack.artists.length > 2 
                        ? `${currentTrack.artists[0]}, ${currentTrack.artists[1]} & ${currentTrack.artists.length - 2} more`
                        : currentTrack.artists.join(', ')
                    ) : (
                      currentTrack?.artist || ''
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full mb-2" style={{ width: '50%', margin: '0 auto' }}>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={progress}
                  onChange={handleSeek}
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
                    onClick={toggleShuffle}
                    className={`control-btn shuffle-btn ${isShuffleOn ? 'active' : ''}`}
                  >
                    <Shuffle size={16} />
                  </button>
                  <button 
                    onClick={toggleLoop}
                    className={`control-btn loop-btn ${loopMode !== 'none' ? 'active' : ''}`}
                  >
                    <Repeat size={16} />
                    {loopMode === 'track' && <span className="loop-indicator" />}
                  </button>
                  <button 
                    onClick={() => setIsQueueModalOpen(true)} 
                    className="control-btn queue-btn"
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
                    onClick={toggleMinimize}
                  >
                    {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Album art modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={toggleModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={toggleModal}>
              <X size={24} />
            </button>
            {currentTrack?.albumArt ? (
              <img 
                src={`data:${currentTrack.albumArt.format};base64,${currentTrack.albumArt.data.replace(/[^A-Za-z0-9+/=]/g, '')}`}
                alt="Album Art"
                className="modal-image"
                onError={(e) => {
                  console.error('Failed to load modal album art, falling back to default');
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_ALBUM_ART;
                  target.onerror = null;
                }}
              />
            ) : (
              <img 
                src={DEFAULT_ALBUM_ART}
                alt="Default Album Art"
                className="modal-image"
              />
            )}
          </div>
        </div>
      )}

      {/* Queue modal */}
      {isQueueModalOpen && (
        <QueueModal 
          userQueue={userQueue}
          shuffleQueue={shuffleQueue}
          onClose={() => setIsQueueModalOpen(false)}
          currentTrack={currentTrack}
          isShuffleOn={isShuffleOn}
          onRemoveFromQueue={removeFromQueue}
          onAddToQueue={addToQueue}
        />
      )}
    </div>
  );
}