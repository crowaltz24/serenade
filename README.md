![logo](https://github.com/user-attachments/assets/8459d706-64d3-438d-a053-bd04fbef5bc9)

# Serenade

A lightweight, open-source music player built with Electron and React, featuring local playback, music organization and downloading capabilities as well as audio visualization features. Created for FOSS Hack 2025.

Demo: https://youtu.be/vaxG7x0cvm8

## Features
- Local audio file playback with modern UI
- Folder and Tracklist level music organization
- Music downloading via SpotDL integration (automatic metadata tagging, playlist download, etc!)
- Real-time audio visualization
- Secure Electron architecture

## Screenshots

![image](https://github.com/user-attachments/assets/80c13acb-b817-4741-8f43-e30b435780cd)

![image](https://github.com/user-attachments/assets/60f668df-b86f-4e2d-95ba-1e5236180459)

![image](https://github.com/user-attachments/assets/93fb8e2f-59e4-4a5d-8bb0-889c7a21c237)

## Installation

NOTE: Serenade is UNTESTED on Unix/Linux/macOS.

```bash
# Clone the repository
git clone https://github.com/yourusername/serenade.git
cd serenade

# Install Node dependencies
npm install

# Set up Python environment
cd backend
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# For Unix/Linux/macOS use:
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Return to root directory
cd ..
```

## Usage

```bash
# Development mode
npm run dev

# Build application (DOESN'T QUITE WORK JUST YET)
npm run build

# Package for distribution (DOESN'T QUITE WORK JUST YET)
npm run package
```

## Development Requirements
- Node.js 18+
- npm 9+
- Python 3.8+ (for SpotDL)

## Tech Stack
- Electron 34.2.0
- React 19.0.0
- TypeScript 5.7.2
- Express 4.21.2
- Vite 6.1.0

## Planned Features
- Additional Visualizer styles
- Custom theme support

## License
MIT License
