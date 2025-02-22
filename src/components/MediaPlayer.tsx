import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import "../index.css";

export default function MediaPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="player-container">
      {/* album art */}
      <div className="album-art">
        <img src="https://placehold.co/300x300" alt="Album Art" className="w-full h-full object-cover" />
      </div>

      {/* song info */}
      <h2 className="song-title">Song Title</h2>
      <p className="artist-name">Artist Name</p>

      {/* controls */}
      <div className="controls">
        <button className="control-btn">
          <SkipBack />
        </button>
        <button className="control-btn" onClick={togglePlay}>
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button className="control-btn">
          <SkipForward />
        </button>
      </div>
    </div>
  );
}
