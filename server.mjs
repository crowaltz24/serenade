import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.get("/file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send("No file specified");

  res.sendFile(path.resolve(filePath));
});

app.listen(PORT, () => {
  console.log(`Serenade Local music server running on http://localhost:${PORT}`);
});
