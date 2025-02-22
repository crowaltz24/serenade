import { useState, useEffect } from 'react';
import { Folder, Download as DownloadIcon, Loader2 } from 'lucide-react';

export default function Download({ 
  tracklistFolder, 
  onDownloadComplete 
}: { 
  tracklistFolder: string;
  onDownloadComplete: () => void;
}) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [downloadDir, setDownloadDir] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Initialize download directory
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
      setMessage('Downloading...');
      
      const response = await fetch('http://localhost:5000/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, target_dir: downloadDir }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Download successful');
        onDownloadComplete();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage('An unknown error occurred');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const selectDownloadFolder = async () => {
    if (window.electron?.selectFolder) {
      const folders = await window.electron.selectFolder();
      if (folders.length > 0) {
        setDownloadDir(folders[0]);
      }
    }
  };

  const folderName = downloadDir ? downloadDir.split(/[\\/]/).pop() || '' : '';

  return (
    <div className="download-container">
      <h2 className="download-title">Download Songs</h2>
      
      <div className="download-content">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter song or playlist URL"
          className="download-input"
          disabled={isDownloading}
        />
        
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
          <div className={`download-message ${
            message.includes('Error') ? 'error' : 
            message.includes('progress') ? 'progress' :
            'success'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
