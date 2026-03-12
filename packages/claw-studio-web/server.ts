import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

const db = new Database("openclaw_v3.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    battery INTEGER DEFAULT 100,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    readme TEXT,
    author TEXT,
    version TEXT,
    icon TEXT,
    category TEXT,
    downloads INTEGER DEFAULT 0,
    rating REAL DEFAULT 0.0,
    size TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    skill_id TEXT,
    user_name TEXT,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS installations (
    device_id TEXT,
    skill_id TEXT,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, skill_id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skill_packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    author TEXT,
    icon TEXT,
    category TEXT,
    downloads INTEGER DEFAULT 0,
    rating REAL DEFAULT 0.0
  );

  CREATE TABLE IF NOT EXISTS skill_pack_items (
    pack_id TEXT,
    skill_id TEXT,
    PRIMARY KEY (pack_id, skill_id),
    FOREIGN KEY (pack_id) REFERENCES skill_packs(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );
`);

// Seed some skills if empty
const skillCount = db.prepare("SELECT COUNT(*) as count FROM skills").get() as { count: number };
if (skillCount.count === 0) {
  const insertSkill = db.prepare("INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  
  const readme1 = `## Overview
The Object Sorting skill is a state-of-the-art vision model designed specifically for the OpenClaw robotic arm. It allows your device to autonomously identify, grasp, and sort objects based on visual characteristics such as color, shape, and size.

![Robot Arm Sorting](https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1200&h=400)

## Key Features
* **Real-Time Vision**: Processes video feed at 30 FPS.
* **Multi-Class Support**: Sort up to 12 different object categories simultaneously.
* **Auto-Calibration**: Automatically adjusts to different lighting conditions.

## Requirements
* OpenClaw Hardware v2.0+
* Top-down camera module
* Minimum 2GB RAM on the host device

## Usage Example
Once installed, you can trigger the sorting process via the OpenClaw API:

\`\`\`javascript
const claw = new OpenClaw('192.168.1.100');

await claw.runSkill('skill-1', {
  mode: 'color',
  targets: ['red', 'blue', 'green'],
  speed: 0.8
});
\`\`\`

## Safety Warning
Ensure the workspace is clear of human hands during operation. The arm moves rapidly between sorting bins.`;

  insertSkill.run(
    "skill-1", 
    "Object Sorting", 
    "Uses vision to sort objects by color and shape.", 
    readme1,
    "OpenClaw Team", 
    "1.2.0", 
    "BoxSelect", 
    "Vision", 
    12500, 
    4.8, 
    "15 MB"
  );
  
  const readmeGeneric = `## Overview\n\nThis is a placeholder documentation for this skill. It provides basic functionality as described in the summary.\n\n### Installation\nClick the install button to deploy directly to your OpenClaw device.`;

  insertSkill.run(
    "skill-2", 
    "Chess Player", 
    "Plays chess against a human using a physical board.", 
    readmeGeneric,
    "RoboGames", 
    "2.0.1", 
    "Gamepad2", 
    "Entertainment", 
    8430, 
    4.9, 
    "42 MB"
  );
  
  insertSkill.run(
    "skill-3", 
    "Drawing Assistant", 
    "Holds a pen and draws SVG files on paper.", 
    readmeGeneric,
    "ArtBot", 
    "1.0.5", 
    "PenTool", 
    "Creative", 
    5200, 
    4.6, 
    "8 MB"
  );
  
  insertSkill.run(
    "skill-4", 
    "Pick and Place API", 
    "Standard industrial pick and place with REST API.", 
    readmeGeneric,
    "OpenClaw Team", 
    "3.1.0", 
    "Move3d", 
    "Utility", 
    21000, 
    4.7, 
    "5 MB"
  );
  
  insertSkill.run(
    "skill-5", 
    "Gesture Mimic", 
    "Mimics human hand gestures via camera.", 
    readmeGeneric,
    "VisionAI", 
    "0.9.0-beta", 
    "HandMetal", 
    "Experimental", 
    3100, 
    4.2, 
    "55 MB"
  );
  
  insertSkill.run(
    "skill-6", 
    "Coffee Maker", 
    "Operates a standard espresso machine.", 
    readmeGeneric,
    "HomeTech", 
    "1.0.0", 
    "Coffee", 
    "Lifestyle", 
    9800, 
    4.5, 
    "12 MB"
  );

  // Seed reviews
  const insertReview = db.prepare("INSERT INTO reviews (id, skill_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)");
  insertReview.run("rev-1", "skill-1", "Alex_Robo", 5, "Incredible skill! Set it up in 5 minutes and it sorted my entire lego collection flawlessly.");
  insertReview.run("rev-2", "skill-1", "TechMaker99", 4, "Works great, but struggles a bit in low light. Make sure your workspace is well lit.");
  insertReview.run("rev-3", "skill-1", "SarahBuilds", 5, "The API integration is seamless. Highly recommend for any automation projects.");
  insertReview.run("rev-4", "skill-2", "ChessMaster", 5, "Beat me on level 10. The physical movement is so smooth.");

  // Seed Packs
  const insertPack = db.prepare("INSERT INTO skill_packs (id, name, description, author, icon, category, downloads, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertPack.run("pack-1", "Industrial Starter Pack", "Essential skills for industrial automation and basic pick-and-place workflows.", "OpenClaw Team", "Package", "Productivity", 15000, 4.9);
  insertPack.run("pack-2", "Entertainment Bundle", "Fun and interactive skills to show off your OpenClaw capabilities.", "RoboGames", "Gamepad2", "Entertainment", 8500, 4.7);

  const insertPackItem = db.prepare("INSERT INTO skill_pack_items (pack_id, skill_id) VALUES (?, ?)");
  insertPackItem.run("pack-1", "skill-1");
  insertPackItem.run("pack-1", "skill-4");
  insertPackItem.run("pack-2", "skill-2");
  insertPackItem.run("pack-2", "skill-3");
}

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json());

  // API Routes
  app.get("/api/devices", (req, res) => {
    const devices = db.prepare("SELECT * FROM devices ORDER BY created_at DESC").all();
    res.json(devices);
  });

  app.post("/api/devices", (req, res) => {
    const { name } = req.body;
    const id = "claw-" + Math.random().toString(36).substr(2, 6);
    const ip = `192.168.1.${Math.floor(Math.random() * 200) + 20}`;
    const battery = Math.floor(Math.random() * 40) + 60; // 60-100
    db.prepare("INSERT INTO devices (id, name, status, battery, ip_address) VALUES (?, ?, ?, ?, ?)").run(id, name, "online", battery, ip);
    const newDevice = db.prepare("SELECT * FROM devices WHERE id = ?").get(id);
    res.json(newDevice);
  });

  app.delete("/api/devices/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM devices WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/skills", (req, res) => {
    const skills = db.prepare("SELECT * FROM skills").all();
    res.json(skills);
  });

  app.get("/api/skills/:id", (req, res) => {
    const { id } = req.params;
    const skill = db.prepare("SELECT * FROM skills WHERE id = ?").get(id);
    if (skill) {
      res.json(skill);
    } else {
      res.status(404).json({ error: "Skill not found" });
    }
  });

  app.get("/api/skills/:id/reviews", (req, res) => {
    const { id } = req.params;
    const reviews = db.prepare("SELECT * FROM reviews WHERE skill_id = ? ORDER BY created_at DESC").all(id);
    res.json(reviews);
  });

  app.get("/api/packs", (req, res) => {
    const packs = db.prepare("SELECT * FROM skill_packs").all();
    res.json(packs);
  });

  app.get("/api/packs/:id", (req, res) => {
    const { id } = req.params;
    const pack = db.prepare("SELECT * FROM skill_packs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (pack) {
      const skills = db.prepare(`
        SELECT s.* 
        FROM skills s 
        JOIN skill_pack_items spi ON s.id = spi.skill_id 
        WHERE spi.pack_id = ?
      `).all(id);
      res.json({ ...pack, skills });
    } else {
      res.status(404).json({ error: "Pack not found" });
    }
  });

  app.get("/api/devices/:id/skills", (req, res) => {
    const { id } = req.params;
    const skills = db.prepare(`
      SELECT s.*, i.installed_at 
      FROM skills s 
      JOIN installations i ON s.id = i.skill_id 
      WHERE i.device_id = ?
    `).all(id);
    res.json(skills);
  });

  app.post("/api/installations", (req, res) => {
    const { device_id, skill_id } = req.body;
    try {
      db.prepare("INSERT INTO installations (device_id, skill_id) VALUES (?, ?)").run(device_id, skill_id);
      db.prepare("UPDATE skills SET downloads = downloads + 1 WHERE id = ?").run(skill_id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already installed or invalid IDs" });
    }
  });

  app.post("/api/installations/pack", (req, res) => {
    const { device_id, pack_id, skill_ids } = req.body;
    try {
      let skillsToInstall: string[] = [];

      if (skill_ids && Array.isArray(skill_ids) && skill_ids.length > 0) {
        skillsToInstall = skill_ids;
      } else {
        const skills = db.prepare("SELECT skill_id FROM skill_pack_items WHERE pack_id = ?").all(pack_id) as { skill_id: string }[];
        skillsToInstall = skills.map(s => s.skill_id);
      }

      const insert = db.prepare("INSERT OR IGNORE INTO installations (device_id, skill_id) VALUES (?, ?)");
      const update = db.prepare("UPDATE skills SET downloads = downloads + 1 WHERE id = ?");
      
      const transaction = db.transaction((skills: string[]) => {
        for (const skillId of skills) {
          const result = insert.run(device_id, skillId);
          if (result.changes > 0) {
            update.run(skillId);
          }
        }
        db.prepare("UPDATE skill_packs SET downloads = downloads + 1 WHERE id = ?").run(pack_id);
      });
      
      transaction(skillsToInstall);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Installation failed" });
    }
  });

  app.delete("/api/installations", (req, res) => {
    const { device_id, skill_id } = req.body;
    db.prepare("DELETE FROM installations WHERE device_id = ? AND skill_id = ?").run(device_id, skill_id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
