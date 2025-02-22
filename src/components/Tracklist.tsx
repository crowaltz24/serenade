import { useState, useEffect } from 'react';
import { type Track } from './MediaPlayer';
import { Folder, RefreshCw } from 'lucide-react';

interface TracklistProps {
  playlist: Track[];
  currentTrack: Track | null;
  onTrackSelect: (track: Track) => void;
  onFolderSelect: () => void;
  folderPath: string;
  onRefresh: () => void;
}

export default function Tracklist({ playlist, currentTrack, onTrackSelect, onFolderSelect, folderPath, onRefresh }: TracklistProps) {
  const [trackDurations, setTrackDurations] = useState<{[key: string]: number}>({});

  useEffect(() => {
    // durations for all tracks
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
      <div className="tracklist">
        {playlist.map((track, index) => (
          <div 
            key={track.fullPath}
            className={`tracklist-item ${currentTrack?.fullPath === track.fullPath ? 'active' : ''}`}
            onClick={() => onTrackSelect(track)}
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
    </div>
  );
} 