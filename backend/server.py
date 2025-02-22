from flask import Flask, jsonify
from ytmusicapi import YTMusic

app = Flask(__name__)
ytmusic = YTMusic()

@app.route("/search/<query>")
def search(query):
    results = ytmusic.search(query)
    return jsonify(results)

if __name__ == "__main__":
    app.run(port=5000)
