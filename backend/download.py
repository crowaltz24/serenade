from flask import Flask, request, jsonify
import subprocess
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

@app.route('/get-song-info', methods=['POST'])
def get_song_info():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # use spotdl's track-info command
        info_process = subprocess.run(['spotdl', url, '--track-info'], 
                                   capture_output=True, text=True)
        output = info_process.stdout.strip()
        
        # extract artist and title from output
        if output:
            
            song_info = output.split('\n')[0] if '\n' in output else output
            return jsonify({'song': song_info}), 200
            
        return jsonify({'song': 'Unknown Song'}), 200
    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download_song():
    data = request.json
    url = data.get('url')
    target_dir = data.get('target_dir', os.path.expanduser('~/Downloads'))
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    try:
        info_process = subprocess.run(['spotdl', url, '--track-info'], 
                                   capture_output=True, text=True)
        
        output_lines = info_process.stdout.strip().split('\n')
        song_info = None
        
        # "Artist - Title" format
        for line in output_lines:
            if ' - ' in line:
                song_info = line.strip()
                break
        
        # NOT "Artist - Title" format
        if not song_info:
            song_info = next((line for line in output_lines if line.strip()), 'Unknown Song')

        # then download
        result = subprocess.run(['spotdl', url, '--output', target_dir], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            return jsonify({'error': result.stderr}), 500

        return jsonify({
            'status': 'success',
            'title': song_info,
            'directory': target_dir
        }), 200

    except Exception as e:
        print("Error:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
