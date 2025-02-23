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

spotdl_path = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "spotdl.exe")

@app.route('/get-song-info', methods=['POST'])
def get_song_info():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # using spotdl's track-info command
        info_process = subprocess.run([spotdl_path, url, '--track-info'], 
                                   capture_output=True, text=True)
        output = info_process.stdout.strip()
        
        if output:
            # "Artist - Title" format
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

    # Check if spotdl is available
    try:
        print("Checking spotdl version...")  # debugging
        version_result = subprocess.run([spotdl_path, '--version'], 
                                      capture_output=True, 
                                      text=True)
        print(f"Version output: {version_result.stdout}")
    except Exception as e:
        import sys
        error_msg = f"""
        Error checking spotdl
        Python executable: {sys.executable}
        PATH: {os.environ.get('PATH')}
        Working directory: {os.getcwd()}
        Error type: {type(e).__name__}
        Error: {str(e)}
        """
        print(error_msg)
        return jsonify({
            'error': f'Error with spotdl: {str(e)}'
        }), 500

    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    try:
        # Get song info
        info_process = subprocess.run([spotdl_path, url, '--track-info'], 
                                   capture_output=True, text=True)
        
        # Parse the info
        output_lines = info_process.stdout.strip().split('\n')
        song_info = None
        
        # find hyphenm
        for line in output_lines:
            if ' - ' in line:
                song_info = line.strip()
                break
        
        # else use the first non-empty line
        if not song_info:
            song_info = next((line for line in output_lines if line.strip()), 'Unknown Song')

        # Then download
        result = subprocess.run([spotdl_path, url, '--output', target_dir], 
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
