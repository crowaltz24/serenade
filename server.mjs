import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.get("/file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send("No file specified");

  res.set({
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes'
  });

  res.sendFile(path.resolve(filePath));
});

app.listen(PORT, () => {
  console.log(`Serenade Local music server running on http://localhost:${PORT}`);
});
