import { useState, useEffect } from 'react';
import { Folder, Download as DownloadIcon, Loader2, X } from 'lucide-react';

export default function Download({ 
  tracklistFolder, 
  onDownloadComplete 
}: { 
  tracklistFolder: string;
  onDownloadComplete: () => void;
}) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'progress' } | null>(null);
  const [downloadDir, setDownloadDir] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // initialize download directory
  useEffect(() => {
    const initDownloadDir = async () => {
      if (window.electron?.getDefaultDownloadDir) {
        const defaultDir = await window.electron.getDefaultDownloadDir();
        setDownloadDir(defaultDir);
      }
    };
    initDownloadDir();
  }, []);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setMessage({ text: 'Downloading...', type: 'progress' });
      
      const response = await fetch('http://localhost:5000/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, target_dir: downloadDir }),
      });

      const data = await response.json();
      if (response.ok) {
        const songTitle = data.title?.trim() || 'Unknown Song';
        setMessage({ 
          text: songTitle !== 'Unknown Song' 
            ? `Successfully downloaded "${songTitle}"`
            : 'Successfully downloaded!',
          type: 'success' 
        });
        onDownloadComplete();
      } else {
        setMessage({ text: `Error: ${data.error}`, type: 'error' });
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage({ text: `Error: ${error.message}`, type: 'error' });
      } else {
        setMessage({ text: 'An unknown error occurred', type: 'error' });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const selectDownloadFolder = async () => {
    if (window.electron?.selectFolder) {
      const folders = await window.electron.selectFolder();
      if (folders.length > 0) {
        // folder path
        const folderPath = folders[0].split(/[\\/]/).slice(0, -1).join('/');
        setDownloadDir(folderPath);
      }
    }
  };

  const getFolderName = (path: string) => {
    // cleaning up op
    const cleanPath = path.replace(/[\\/]+$/, '');
    return cleanPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || '';
  };

  const folderName = downloadDir ? getFolderName(downloadDir) : '';

  const handleClear = () => {
    setUrl('');
    setMessage(null);
  };

  return (
    <div className="download-container">
      <h2 className="download-title">Download Songs</h2>
      
      <div className="download-content">
        <div className="relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter Spotify URL for song or playlist"
            className="download-input"
            disabled={isDownloading}
          />
          {url && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="download-options">
          <div className="folder-selection">
            {folderName && <span className="folder-name">{folderName}</span>}
            <button 
              onClick={selectDownloadFolder} 
              className="change-folder-btn"
              disabled={isDownloading}
            >
              <Folder size={16} />
              Change Folder
            </button>
            <button 
              onClick={() => setDownloadDir(tracklistFolder)} 
              className="change-folder-btn"
              disabled={!tracklistFolder || isDownloading}
            >
              Use Tracklist Folder
            </button>
          </div>

          <button 
            onClick={handleDownload} 
            className={`download-button ${isDownloading ? 'downloading' : ''}`}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 size={20} className="spin" />
            ) : (
              <DownloadIcon size={20} />
            )}
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
        </div>

        {message && (
          <div className={`download-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
