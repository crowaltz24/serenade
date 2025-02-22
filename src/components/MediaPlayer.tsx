import { useState, useRef, useEffect } from "react";
import { Play, Pause, Folder, SkipForward, SkipBack } from "lucide-react";

export default function MediaPlayer() {
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());

  // select folder & update playlist
  const selectFolder = async () => {
    if (window.electron?.selectFolder) {      // CHECK IF AVAILABLE
      const files = await window.electron.selectFolder();
      if (files.length > 0) {
        setPlaylist(files);
        setCurrentTrack(files[0]);
      }
    } else {
      console.error("Electron API not available");
    }
  };

  // play/pause
  const togglePlay = async () => {
    if (!currentTrack) return;
    const audio = audioRef.current;
  
    if (isPlaying) {
      audio.pause();
    } else {
      const safeUrl = await window.electron.getFileUrl(currentTrack);
      audio.src = safeUrl;
      await audio.play();
    }
  
    setIsPlaying(!isPlaying);
  };
  
  

  // load new track on track change
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack) {
      (async () => {
        const safeUrl = await window.electron.getFileUrl(currentTrack);
        audio.src = safeUrl;
        if (isPlaying) audio.play();
      })();
    }

    const updateProgress = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 1);

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", () => setCurrentTrack(getNextTrack()));

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", () => setCurrentTrack(getNextTrack()));
    };
  }, [currentTrack, isPlaying]);

  // get next track
  const getNextTrack = () => {
    if (!playlist.length) return null;
    const currentIndex = playlist.indexOf(currentTrack!);
    return playlist[(currentIndex + 1) % playlist.length];
  };

  // get previous track
  const getPrevTrack = () => {
    if (!playlist.length) return null;
    const currentIndex = playlist.indexOf(currentTrack!);
    return playlist[(currentIndex - 1 + playlist.length) % playlist.length];
  };

  // play next/previous track
  const playNext = () => setCurrentTrack(getNextTrack());
  const playPrevious = () => setCurrentTrack(getPrevTrack());

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Serenade</h1>

      <button
        onClick={selectFolder}
        className="bg-blue-500 px-4 py-2 rounded-lg flex items-center gap-2 mb-4"
      >
        <Folder size={20} />
        Select Music Folder
      </button>

      {/* current track */}
      <div className="w-96 bg-gray-800 p-4 rounded-lg shadow-md text-center">
        {currentTrack ? (
          <p className="text-lg font-semibold">{currentTrack.split("/").pop()}</p>
        ) : (
          <p className="text-gray-400">No track selected.</p>
        )}
      </div>

      {/* progress bar */}
      <div className="w-96 bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
        <div
          className="bg-blue-500 h-full"
          style={{ width: `${(progress / duration) * 100 || 0}%` }}
        />
      </div>

      {/* player controls */}
      <div className="flex items-center gap-6 mt-4">
        <button onClick={playPrevious} className="p-3 bg-gray-700 rounded-full">
          <SkipBack />
        </button>
        <button onClick={togglePlay} className="p-4 bg-blue-500 rounded-full">
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button onClick={playNext} className="p-3 bg-gray-700 rounded-full">
          <SkipForward />
        </button>
      </div>
    </div>
  );
}
