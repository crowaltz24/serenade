import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  currentTrack?: { 
    title?: string;
    artist?: string;
    artists?: string[];
    name?: string;
  } | null;
}

type VisualizerType = 'classic' | 'alternative';
type ColorTheme = 'gradient' | 'serenade' | 'white'; 
type BarCount = '64' | '128' | '256' | '512' | '1024';
type SmoothingValue = number;

export default function AudioVisualizer({ isPlaying, currentTrack }: AudioVisualizerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('classic');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('serenade');
  const [barCount, setBarCount] = useState<BarCount>('256');  // default to medium detail
  const [pendingBarCount, setPendingBarCount] = useState<BarCount>('256');
  const [opacityScaling, setOpacityScaling] = useState(true);
  const [smoothing, setSmoothing] = useState<SmoothingValue>(0.85);  // 85% is a good balance between responsive and smooth
  const [pendingSmoothing, setPendingSmoothing] = useState<SmoothingValue>(0.85);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const lastDataArrayRef = useRef<Uint8Array | null>(null);
  const decayFactorRef = useRef(0.9);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedBarCountRef = useRef<BarCount>('256');
  const lastCommittedSmoothingRef = useRef<SmoothingValue>(0.75);
  const smoothingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedType = localStorage.getItem('visualizerType') as VisualizerType;
    const savedTheme = localStorage.getItem('colorTheme') as ColorTheme;
    const savedOpacityScaling = localStorage.getItem('opacityScaling');
    
    if (savedType) setVisualizerType(savedType);
    if (savedTheme) setColorTheme(savedTheme);
    if (savedOpacityScaling !== null) setOpacityScaling(savedOpacityScaling === 'true');
  }, []);

  const initAudio = async () => {
    try {
      const audioElement = document.getElementById('main-audio-element') as HTMLAudioElement;
      if (!audioElement) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // create analyzer
      analyzerRef.current = audioCtxRef.current.createAnalyser();
      const fftSize = parseInt(lastCommittedBarCountRef.current) * 2;
      // console.log('initAudio: Setting FFT size to', fftSize, 'for barCount', lastCommittedBarCountRef.current);
      analyzerRef.current.fftSize = fftSize;
      analyzerRef.current.minDecibels = -70;
      analyzerRef.current.maxDecibels = -30;
      analyzerRef.current.smoothingTimeConstant = lastCommittedSmoothingRef.current;

      // gain node for analyzer
      const analyzerGain = audioCtxRef.current.createGain();
      analyzerGain.gain.value = 1;

      if (!sourceRef.current) {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioElement);
      }

      // source -> analyzer -> gain -> destination
      sourceRef.current.connect(analyzerGain);
      analyzerGain.connect(analyzerRef.current);
      sourceRef.current.connect(audioCtxRef.current.destination);

      isInitializedRef.current = true;
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  };

  const reinitializeAudio = async (newBarCount: BarCount) => {
    try {
      // console.log('reinitializeAudio: Starting with barCount', newBarCount);
      
      // Clean up
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyzerRef.current) {
        analyzerRef.current.disconnect();
      }

      const audioElement = document.getElementById('main-audio-element') as HTMLAudioElement;
      if (!audioElement) {
        console.log('No audio element found');
        return;
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        // console.log('Creating new AudioContext');
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Create new analyzer with updated settings
      analyzerRef.current = audioCtxRef.current.createAnalyser();
      const fftSize = parseInt(newBarCount) * 2;
      // console.log('reinitializeAudio: Setting FFT size to', fftSize, 'for barCount', newBarCount);
      analyzerRef.current.fftSize = fftSize;
      analyzerRef.current.minDecibels = -70;
      analyzerRef.current.maxDecibels = -30;
      analyzerRef.current.smoothingTimeConstant = lastCommittedSmoothingRef.current;

      // gain node for analyzer
      const analyzerGain = audioCtxRef.current.createGain();
      analyzerGain.gain.value = 1;

      if (!sourceRef.current) {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioElement);
      }

      // Reconnect everything
      sourceRef.current.connect(analyzerGain);
      analyzerGain.connect(analyzerRef.current);
      sourceRef.current.connect(audioCtxRef.current.destination);

      // console.log('reinitializeAudio: Complete. New FFT size:', analyzerRef.current.fftSize);
    } catch (error) {
      console.error('Error reinitializing audio:', error);
    }
  };

  const saveSettings = async (
    type: VisualizerType, 
    theme: ColorTheme, 
    bars: BarCount,
    scaling: boolean
  ) => {
    localStorage.setItem('visualizerType', type);
    localStorage.setItem('colorTheme', theme);
    localStorage.setItem('opacityScaling', scaling.toString());
    
    // update state after saving permanent settings
    setVisualizerType(type);
    setColorTheme(theme);
    setOpacityScaling(scaling);
    
    // handle bar count changes without saving
    if (bars !== lastCommittedBarCountRef.current) {
      lastCommittedBarCountRef.current = bars;
      setBarCount(bars);
      await reinitializeAudio(bars);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawBars = () => {
      if (!analyzerRef.current || !canvas || !ctx) return;

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      if (isPlaying) {
        analyzerRef.current.getByteFrequencyData(dataArray);
        lastDataArrayRef.current = new Uint8Array(dataArray);
      } else if (lastDataArrayRef.current) {
        for (let i = 0; i < bufferLength; i++) {
          lastDataArrayRef.current[i] *= decayFactorRef.current;
        }
        dataArray.set(lastDataArrayRef.current);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(26, 27, 38, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * (visualizerType === 'classic' ? 2 : 2.5);
      const barSpacing = visualizerType === 'classic' ? 2 : 1;
      let x = 0;

      let hasVisibleBars = false;
      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        if (percent > 0.001) hasVisibleBars = true;

        const height = (canvas.height * percent * 0.8);
        
        let color;
        if (colorTheme === 'gradient') {
          const hue = (360 * (i / bufferLength)) + ((Date.now() / 50) % 360);

          const opacity = opacityScaling ? 0.3 + (percent * 0.7) : 1;
          color = {
            start: `hsla(${hue}, 100%, 50%, ${opacity})`,
            end: `hsla(${hue}, 100%, 70%, ${opacity * 0.5})`
          };
        } else if (colorTheme === 'white') {

          const opacity = opacityScaling ? 0.3 + (percent * 0.7) : 1;
          color = {
            start: `rgba(255, 255, 255, ${opacity})`,
            end: `rgba(255, 255, 255, ${opacity * 0.5})`
          };
        } else {
          const baseColor: {
            r: number; g: number; b: number;
            r2: number; g2: number; b2: number;
          } = {
            r: 111, g: 93, b: 252,
            r2: 46, g2: 222, b2: 250 
          };
          
          const mix = i / bufferLength;
          const opacity = opacityScaling ? 0.3 + (percent * 0.7) : 1;
          color = {
            start: `rgba(${
              Math.round(baseColor.r * (1 - mix) + baseColor.r2 * mix)},${
              Math.round(baseColor.g * (1 - mix) + baseColor.g2 * mix)},${
              Math.round(baseColor.b * (1 - mix) + baseColor.b2 * mix)},${
              opacity
            })`,
            end: `rgba(${
              Math.round(baseColor.r * (1 - mix) + baseColor.r2 * mix)},${
              Math.round(baseColor.g * (1 - mix) + baseColor.g2 * mix)},${
              Math.round(baseColor.b * (1 - mix) + baseColor.b2 * mix)},${
              opacity * 0.5
            })`
          };
        }

        const gradient = ctx.createLinearGradient(0, canvas.height - height, 0, canvas.height);
        gradient.addColorStop(0, color.start);
        gradient.addColorStop(1, color.end);
        ctx.fillStyle = gradient;

        // Classic style
        if (visualizerType === 'classic') {
          ctx.fillRect(x, canvas.height - height, barWidth, height);
        } else {
          // Alternative style only draws top line with thickness
          const lineThickness = 3;
          ctx.fillRect(
            x, 
            canvas.height - height - lineThickness/2, 
            barWidth, 
            lineThickness
          );
        }

        x += barWidth + barSpacing;
      }

      return hasVisibleBars;
    };

    const animate = () => {
      if (!isInitializedRef.current) {
        initAudio().then(() => {
          if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
          }
        });
        return;
      }

      const hasVisibleBars = drawBars();
      
      if (isPlaying || hasVisibleBars) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      if (!isInitializedRef.current) {
        initAudio().then(() => {
          animate();
        });
      } else {
        animate();
      }
    } else {
      animate();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, visualizerType, colorTheme, barCount, opacityScaling, smoothing]);

  const handleBarCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    let newBarCount: BarCount = '128';

    // mapping
    switch (value) {
      case 1: newBarCount = '64'; break;   // Lowest
      case 2: newBarCount = '128'; break;  // Low
      case 3: newBarCount = '256'; break;  // Medium
      case 4: newBarCount = '512'; break;  // High
      case 5: newBarCount = '1024'; break; // Ultra
    }

    // console.log('handleBarCountChange:', value, '->', newBarCount);

    // immediate upate for visual feedback
    setPendingBarCount(newBarCount);

    // Clear pending updates
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // audio reinitialize
    debounceTimerRef.current = setTimeout(async () => {
      const finalBarCount = newBarCount; // final value
      lastCommittedBarCountRef.current = finalBarCount;
      setBarCount(finalBarCount);
      await reinitializeAudio(finalBarCount);
      debounceTimerRef.current = null;
    }, 500);
  };

  const handleSmoothingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSmoothing = parseFloat(event.target.value);
    setPendingSmoothing(newSmoothing);

    if (smoothingDebounceRef.current) {
      clearTimeout(smoothingDebounceRef.current);
      smoothingDebounceRef.current = null;
    }

    smoothingDebounceRef.current = setTimeout(() => {
      lastCommittedSmoothingRef.current = newSmoothing;
      setSmoothing(newSmoothing);
      if (analyzerRef.current) {
        analyzerRef.current.smoothingTimeConstant = newSmoothing;
      }
    }, 500);
  };

  // BREAKS WITHOUT MAPPING IT AGAIN IDK WHATS GOING ON
  const getSliderValue = (count: BarCount): number => {
    switch (count) {
      case '64': return 1;   // Lowest
      case '128': return 2;  // Low
      case '256': return 3;  // Medium
      case '512': return 4;  // High
      case '1024': return 5; // Ultra
      default: return 3;     // Default to Medium
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (smoothingDebounceRef.current) {
        clearTimeout(smoothingDebounceRef.current);
        smoothingDebounceRef.current = null;
      }
    };
  }, []);

  // click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings && !(event.target as Element).closest('.visualizer-settings-menu') && 
          !(event.target as Element).closest('.visualizer-settings-btn')) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  return (
    <>
      <div className="visualizer-container">
        {currentTrack && (
          <div className="visualizer-track-info">
            <div className="visualizer-track-title">
              {currentTrack.title || currentTrack.name || 'No track selected'}
            </div>
            <div className="visualizer-track-artist">
              {currentTrack.artists 
                ? currentTrack.artists.join(', ')
                : currentTrack.artist || ''}
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="audio-visualizer" />
      </div>
      
      <button 
        className="visualizer-settings-btn"
        onClick={() => setShowSettings(!showSettings)}
        style={{ top: '20px', right: '20px' }}
      >
        <Settings size={16} />
      </button>

      {showSettings && (
        <div className="visualizer-settings-menu">
          <div className="visualizer-settings-group">
            <h3>Style</h3>
            <button 
              className={`setting-btn ${visualizerType === 'classic' ? 'active' : ''}`}
              onClick={() => saveSettings('classic', colorTheme, barCount, opacityScaling)}
            >
              Classic
            </button>
            <button 
              className={`setting-btn ${visualizerType === 'alternative' ? 'active' : ''}`}
              onClick={() => saveSettings('alternative', colorTheme, barCount, opacityScaling)}
            >
              Alternative
            </button>
          </div>

          <div className="visualizer-settings-group">
            <h3>Colors</h3>
            <button 
              className={`setting-btn ${colorTheme === 'serenade' ? 'active' : ''}`}
              onClick={() => saveSettings(visualizerType, 'serenade', barCount, opacityScaling)}
            >
              Serenade
            </button>
            <button 
              className={`setting-btn ${colorTheme === 'gradient' ? 'active' : ''}`}
              onClick={() => saveSettings(visualizerType, 'gradient', barCount, opacityScaling)}
            >
              Rainbow
            </button>
            <button 
              className={`setting-btn ${colorTheme === 'white' ? 'active' : ''}`}
              onClick={() => saveSettings(visualizerType, 'white', barCount, opacityScaling)}
            >
              White
            </button>
          </div>

          <div className="visualizer-settings-group">
            <h3>Options</h3>
            <button 
              className={`setting-btn ${opacityScaling ? 'active' : ''}`}
              onClick={() => saveSettings(visualizerType, colorTheme, barCount, !opacityScaling)}
            >
              Amplitude Opacity
            </button>
          </div>

          <div className="visualizer-settings-group">
            <h3>Detail Level</h3>
            <div className="slider-container">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={getSliderValue(pendingBarCount)}
                onChange={handleBarCountChange}
                className="detail-slider"
              />
              <div className="slider-labels">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>

          <div className="visualizer-settings-group">
            <h3>Smoothing</h3>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="0.99"
                step="0.01"
                value={pendingSmoothing}
                onChange={handleSmoothingChange}
                className="smoothing-slider"
              />
              <div className="slider-labels">
                <span>Sharp</span>
                <span>{(pendingSmoothing * 100).toFixed(0)}%</span>
                <span>Smooth</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}