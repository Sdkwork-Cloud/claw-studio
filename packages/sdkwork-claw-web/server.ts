import express from "express";
import { createServer as createViteServer } from "vite";
import initSqlJs, { Database } from "sql.js";

let db: Database;

async function initDatabase() {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  db.run(`
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

    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      iconType TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      version TEXT,
      uptime TEXT,
      ip TEXT,
      cpu INTEGER DEFAULT 0,
      memory INTEGER DEFAULT 0,
      totalMemory TEXT
    );

    CREATE TABLE IF NOT EXISTS instance_configs (
      instance_id TEXT PRIMARY KEY,
      port TEXT,
      sandbox BOOLEAN DEFAULT 1,
      autoUpdate BOOLEAN DEFAULT 0,
      logLevel TEXT DEFAULT 'info',
      corsOrigins TEXT DEFAULT '*',
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS instance_tokens (
      instance_id TEXT PRIMARY KEY,
      token TEXT,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      actionType TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      lastRun TEXT,
      nextRun TEXT,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      firstName TEXT,
      lastName TEXT,
      email TEXT,
      avatarUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      preferences TEXT
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT,
      author_avatar TEXT,
      author_role TEXT,
      author_bio TEXT,
      category TEXT,
      tags TEXT,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cover_image TEXT
    );

    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      author_name TEXT,
      author_avatar TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      likes INTEGER DEFAULT 0,
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS github_repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      author TEXT,
      description TEXT,
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      tags TEXT,
      iconUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS huggingface_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      author TEXT,
      description TEXT,
      downloads INTEGER DEFAULT 0,
      tags TEXT,
      iconUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS app_store_apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      developer TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      banner TEXT,
      icon TEXT NOT NULL,
      rating REAL DEFAULT 0.0,
      rank INTEGER,
      reviewsCount TEXT,
      screenshots TEXT,
      version TEXT,
      size TEXT,
      releaseDate TEXT,
      compatibility TEXT,
      ageRating TEXT,
      is_featured BOOLEAN DEFAULT 0,
      is_top_chart BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_store_categories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_store_category_apps (
      category_id TEXT,
      app_id TEXT,
      PRIMARY KEY (category_id, app_id),
      FOREIGN KEY (category_id) REFERENCES app_store_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (app_id) REFERENCES app_store_apps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claws (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      ip TEXT,
      version TEXT,
      os TEXT,
      uptime TEXT,
      cpuUsage INTEGER DEFAULT 0,
      ramUsage INTEGER DEFAULT 0,
      lastSeen TEXT,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS claw_details (
      id TEXT PRIMARY KEY,
      kernel TEXT,
      diskUsage INTEGER DEFAULT 0,
      macAddress TEXT,
      connectedDevices INTEGER DEFAULT 0,
      activeTasks INTEGER DEFAULT 0,
      FOREIGN KEY (id) REFERENCES claws(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      status TEXT DEFAULT 'not_configured',
      enabled BOOLEAN DEFAULT 0,
      setupGuide TEXT,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS channel_fields (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      placeholder TEXT,
      value TEXT,
      helpText TEXT,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );
  `);

  const skillCount = db.exec("SELECT COUNT(*) as count FROM skills")[0]?.values[0]?.[0] as number || 0;
  if (skillCount === 0) {
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

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-1", "Object Sorting", "Uses vision to sort objects by color and shape.", readme1, "OpenClaw Team", "1.2.0", "BoxSelect", "Vision", 12500, 4.8, "15 MB"]
    );

    const readmeGeneric = `## Overview\n\nThis is a placeholder documentation for this skill. It provides basic functionality as described in the summary.\n\n### Installation\nClick the install button to deploy directly to your OpenClaw device.`;

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-2", "Chess Player", "Plays chess against a human using a physical board.", readmeGeneric, "RoboGames", "2.0.1", "Gamepad2", "Entertainment", 8430, 4.9, "42 MB"]
    );

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-3", "Drawing Assistant", "Holds a pen and draws SVG files on paper.", readmeGeneric, "ArtBot", "1.0.5", "PenTool", "Creative", 5200, 4.6, "8 MB"]
    );

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-4", "Pick and Place API", "Standard industrial pick and place with REST API.", readmeGeneric, "OpenClaw Team", "3.1.0", "Move3d", "Utility", 21000, 4.7, "5 MB"]
    );

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-5", "Gesture Mimic", "Mimics human hand gestures via camera.", readmeGeneric, "VisionAI", "0.9.0-beta", "HandMetal", "Experimental", 3100, 4.2, "55 MB"]
    );

    db.run(
      "INSERT INTO skills (id, name, description, readme, author, version, icon, category, downloads, rating, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["skill-6", "Coffee Maker", "Operates a standard espresso machine.", readmeGeneric, "HomeTech", "1.0.0", "Coffee", "Lifestyle", 9800, 4.5, "12 MB"]
    );

    db.run("INSERT INTO reviews (id, skill_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)", ["rev-1", "skill-1", "Alex_Robo", 5, "Incredible skill! Set it up in 5 minutes and it sorted my entire lego collection flawlessly."]);
    db.run("INSERT INTO reviews (id, skill_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)", ["rev-2", "skill-1", "TechMaker99", 4, "Works great, but struggles a bit in low light. Make sure your workspace is well lit."]);
    db.run("INSERT INTO reviews (id, skill_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)", ["rev-3", "skill-1", "SarahBuilds", 5, "The API integration is seamless. Highly recommend for any automation projects."]);
    db.run("INSERT INTO reviews (id, skill_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)", ["rev-4", "skill-2", "ChessMaster", 5, "Beat me on level 10. The physical movement is so smooth."]);

    db.run("INSERT INTO skill_packs (id, name, description, author, icon, category, downloads, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ["pack-1", "Industrial Starter Pack", "Essential skills for industrial automation and basic pick-and-place workflows.", "OpenClaw Team", "Package", "Productivity", 15000, 4.9]);
    db.run("INSERT INTO skill_packs (id, name, description, author, icon, category, downloads, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ["pack-2", "Entertainment Bundle", "Fun and interactive skills to show off your OpenClaw capabilities.", "RoboGames", "Gamepad2", "Entertainment", 8500, 4.7]);

    db.run("INSERT INTO skill_pack_items (pack_id, skill_id) VALUES (?, ?)", ["pack-1", "skill-1"]);
    db.run("INSERT INTO skill_pack_items (pack_id, skill_id) VALUES (?, ?)", ["pack-1", "skill-4"]);
    db.run("INSERT INTO skill_pack_items (pack_id, skill_id) VALUES (?, ?)", ["pack-2", "skill-2"]);
    db.run("INSERT INTO skill_pack_items (pack_id, skill_id) VALUES (?, ?)", ["pack-2", "skill-3"]);
  }

  const instanceCount = db.exec("SELECT COUNT(*) as count FROM instances")[0]?.values[0]?.[0] as number || 0;
  if (instanceCount === 0) {
    db.run("INSERT INTO instances (id, name, type, iconType, status, version, uptime, ip, cpu, memory, totalMemory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['local-mac', 'MacBook Pro (Local)', 'macOS Native', 'apple', 'online', 'v0.2.1', '5d 12h', '127.0.0.1', 12, 35, '32 GB']);
    db.run("INSERT INTO instance_configs (instance_id, port, sandbox, autoUpdate, logLevel, corsOrigins) VALUES (?, ?, ?, ?, ?, ?)", ['local-mac', '18789', 1, 0, 'info', '*']);
    db.run("INSERT INTO instance_tokens (instance_id, token) VALUES (?, ?)", ['local-mac', 'oc_token_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c']);

    db.run("INSERT INTO instances (id, name, type, iconType, status, version, uptime, ip, cpu, memory, totalMemory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['home-server', 'Home NAS Gateway', 'Docker Container', 'box', 'online', 'v0.2.1', '32d 4h', '192.168.1.100', 45, 68, '16 GB']);
    db.run("INSERT INTO instance_configs (instance_id, port, sandbox, autoUpdate, logLevel, corsOrigins) VALUES (?, ?, ?, ?, ?, ?)", ['home-server', '18789', 1, 1, 'warn', 'http://localhost:3000']);
    db.run("INSERT INTO instance_tokens (instance_id, token) VALUES (?, ?)", ['home-server', 'oc_token_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p']);

    db.run("INSERT INTO instances (id, name, type, iconType, status, version, uptime, ip, cpu, memory, totalMemory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['aws-node', 'AWS EC2 Node', 'Ubuntu Linux', 'server', 'offline', 'v0.2.0', '-', '3.14.15.92', 0, 0, '64 GB']);
    db.run("INSERT INTO instance_configs (instance_id, port, sandbox, autoUpdate, logLevel, corsOrigins) VALUES (?, ?, ?, ?, ?, ?)", ['aws-node', '8080', 1, 1, 'error', '*']);
    db.run("INSERT INTO instance_tokens (instance_id, token) VALUES (?, ?)", ['aws-node', 'oc_token_q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6']);
  }

  const taskCount = db.exec("SELECT COUNT(*) as count FROM tasks")[0]?.values[0]?.[0] as number || 0;
  if (taskCount === 0) {
    db.run("INSERT INTO tasks (id, name, schedule, actionType, status, lastRun, nextRun) VALUES (?, ?, ?, ?, ?, ?, ?)", ['task-1', 'Daily System Check', '0 0 * * *', 'skill', 'active', '2 hours ago', 'in 22 hours']);
    db.run("INSERT INTO tasks (id, name, schedule, actionType, status, lastRun, nextRun) VALUES (?, ?, ?, ?, ?, ?, ?)", ['task-2', 'Weekly Report', '0 9 * * 1', 'message', 'paused', '3 days ago', '-']);
  }

  const userProfileCount = db.exec("SELECT COUNT(*) as count FROM user_profile")[0]?.values[0]?.[0] as number || 0;
  if (userProfileCount === 0) {
    db.run("INSERT INTO user_profile (id, firstName, lastName, email) VALUES (?, ?, ?, ?)", ['user-1', 'John', 'Doe', 'john.doe@example.com']);

    const defaultPrefs = {
      general: { launchOnStartup: true, startMinimized: false },
      notifications: { systemUpdates: true, taskFailures: true, securityAlerts: true, taskCompletions: false, newMessages: true },
      privacy: { shareUsageData: true, personalizedRecommendations: true },
      security: { twoFactorAuth: false, loginAlerts: true }
    };
    db.run("INSERT INTO user_preferences (id, preferences) VALUES (?, ?)", ['user-1', JSON.stringify(defaultPrefs)]);
  }

  const communityPostCount = db.exec("SELECT COUNT(*) as count FROM community_posts")[0]?.values[0]?.[0] as number || 0;
  if (communityPostCount === 0) {
    db.run(
      "INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, author_bio, category, tags, likes, comments, views, created_at, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        'post-1',
        'Getting Started with OpenClaw: A Comprehensive Guide',
        `Welcome to OpenClaw! This guide will walk you through the essential steps to get your environment up and running.\n\n## 1. Installation\n\nFirst, you'll need to install the Claw Studio application. You can download it directly from our website or use the command line:\n\n\`\`\`bash\ncurl -sSL https://openclaw.dev/install | bash\n\`\`\`\n\n## 2. Configuring Your First Instance\n\nOnce installed, navigate to the **Instances** tab. Click on "Create Instance" and select the "Starter Pack" template. This will automatically provision a local environment with all the necessary dependencies.\n\n### Key Configuration Options:\n- **Memory Allocation**: We recommend at least 8GB for smooth operation.\n- **Port Mapping**: Ensure port 3000 is available.\n\n## 3. Writing Your First Automation\n\nOpen the built-in IDE and create a new file called \`hello.ts\`. Paste the following code:\n\n\`\`\`typescript\nimport { Claw } from '@openclaw/sdk';\n\nconst claw = new Claw();\n\nclaw.on('ready', () => {\n  console.log('OpenClaw is ready to automate!');\n});\n\nclaw.start();\n\`\`\`\n\nRun the script using the terminal, and you should see the success message!\n\n## Conclusion\n\nThis is just the beginning. Explore the ClawHub marketplace to find pre-built skills, or dive into the documentation to learn how to build your own complex workflows.`,
        'Alex Chen',
        'https://picsum.photos/seed/alex/100/100',
        'Core Contributor',
        'Building the future of open-source automation.',
        'Tutorials',
        JSON.stringify(['Beginner', 'Setup', 'Guide']),
        342,
        56,
        1205,
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        'https://picsum.photos/seed/post1/1200/500'
      ]
    );

    db.run(
      "INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, author_bio, category, tags, likes, comments, views, created_at, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        'post-2',
        'How to optimize vision models for real-time processing',
        'Vision models require careful optimization...',
        'Sarah Jenkins',
        'https://picsum.photos/seed/sarah/100/100',
        'AI Researcher',
        null,
        'Discussions',
        JSON.stringify(['Computer Vision', 'Performance']),
        128,
        34,
        890,
        new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        null
      ]
    );

    db.run(
      "INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, author_bio, category, tags, likes, comments, views, created_at, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        'post-3',
        "Announcing OpenClaw v2.0: What's New",
        'We are thrilled to announce the release of OpenClaw v2.0...',
        'OpenClaw Team',
        'https://picsum.photos/seed/team/100/100',
        'Official',
        null,
        'Announcements',
        JSON.stringify(['Release', 'Update']),
        892,
        145,
        5400,
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        'https://picsum.photos/seed/release/1200/500'
      ]
    );

    db.run(
      "INSERT INTO community_comments (id, post_id, author_name, author_avatar, content, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'comment-1',
        'post-1',
        'Sarah Jenkins',
        'https://picsum.photos/seed/sarah/100/100',
        'This is exactly what I needed! The CLI installation method is so much faster.',
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        12
      ]
    );

    db.run(
      "INSERT INTO community_comments (id, post_id, author_name, author_avatar, content, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'comment-2',
        'post-1',
        'David Kim',
        'https://picsum.photos/seed/david/100/100',
        'Quick question: Does the starter pack include the vision processing modules by default?',
        new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        3
      ]
    );
  }

  const githubRepoCount = db.exec("SELECT COUNT(*) as count FROM github_repos")[0]?.values[0]?.[0] as number || 0;
  if (githubRepoCount === 0) {
    const bases = [
      { name: 'llama.cpp', author: 'ggerganov', tags: ['C++', 'LLM', 'Inference'] },
      { name: 'stable-diffusion-webui', author: 'AUTOMATIC1111', tags: ['Python', 'Stable Diffusion', 'UI'] },
      { name: 'LangChain', author: 'langchain-ai', tags: ['Python', 'LLM', 'Agents'] },
      { name: 'AutoGPT', author: 'Significant-Gravitas', tags: ['Python', 'Autonomous', 'GPT-4'] },
      { name: 'ollama', author: 'ollama', tags: ['Go', 'LLM', 'Local'] },
      { name: 'whisper', author: 'openai', tags: ['Python', 'Speech Recognition', 'Audio'] }
    ];

    for (let i = 0; i < 1000; i++) {
      const base = bases[i % bases.length];
      db.run(
        "INSERT INTO github_repos (id, name, author, description, stars, forks, tags, iconUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          `gh-${i}`,
          `${base.name}-${i}`,
          base.author,
          `High-performance port of ${base.name} optimized for local execution. Instance #${i}.`,
          Math.floor(Math.random() * 100000) + 1000,
          Math.floor(Math.random() * 20000) + 100,
          JSON.stringify(base.tags),
          `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 10000000)}?s=200&v=4`
        ]
      );
    }
  }

  const huggingfaceModelCount = db.exec("SELECT COUNT(*) as count FROM huggingface_models")[0]?.values[0]?.[0] as number || 0;
  if (huggingfaceModelCount === 0) {
    const bases = [
      { name: 'Llama-3-8B-Instruct', author: 'meta-llama', tags: ['Text Generation', 'LLM', 'Instruct'] },
      { name: 'stable-diffusion-xl-base-1.0', author: 'stabilityai', tags: ['Text-to-Image', 'Diffusion'] },
      { name: 'Mixtral-8x7B-Instruct-v0.1', author: 'mistralai', tags: ['Text Generation', 'MoE'] },
      { name: 'whisper-large-v3', author: 'openai', tags: ['Speech Recognition', 'Audio'] },
      { name: 'Qwen1.5-14B-Chat', author: 'Qwen', tags: ['Text Generation', 'Chat', 'Chinese'] },
      { name: 'all-MiniLM-L6-v2', author: 'sentence-transformers', tags: ['Sentence Similarity', 'Embeddings'] }
    ];

    for (let i = 0; i < 1000; i++) {
      const base = bases[i % bases.length];
      db.run(
        "INSERT INTO huggingface_models (id, name, author, description, downloads, tags, iconUrl) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          `hf-${i}`,
          `${base.name}-v${Math.floor(i/10)}.${i%10}`,
          base.author,
          `State-of-the-art model for ${base.tags[0]}. This is variant #${i} optimized for specific use cases.`,
          Math.floor(Math.random() * 50000000) + 100000,
          JSON.stringify(base.tags),
          'https://huggingface.co/front/assets/huggingface_logo-noborder.svg'
        ]
      );
    }
  }

  const appStoreCount = db.exec("SELECT COUNT(*) as count FROM app_store_apps")[0]?.values[0]?.[0] as number || 0;
  if (appStoreCount === 0) {
    const generateExtendedData = (id: string, name: string) => ({
      reviewsCount: '12.4K',
      screenshots: JSON.stringify([
        `https://picsum.photos/seed/${id}_1/800/500`,
        `https://picsum.photos/seed/${id}_2/800/500`,
        `https://picsum.photos/seed/${id}_3/800/500`,
      ]),
      version: '2.1.0',
      size: '342 MB',
      releaseDate: 'Oct 24, 2023',
      compatibility: 'macOS 12.0 or later, Windows 11, Linux',
      ageRating: '4+',
      description: `This is a detailed description for ${name}. It includes all the features and capabilities of the application. It is designed to be highly performant and easy to use.`
    });

    const featuredApp = {
      id: 'app-1',
      name: 'Claw AI Studio',
      developer: 'Claw Studio Inc.',
      category: 'AI Development',
      description: 'The ultimate IDE for building and fine-tuning OpenClaw AI skills. Features intelligent code completion, visual prompt debugging, and one-click model deployment.',
      banner: 'https://picsum.photos/seed/clawstudio_banner/1200/600?blur=2',
      icon: 'https://picsum.photos/seed/clawstudio/200/200',
      rating: 5.0,
      ...generateExtendedData('app-1', 'Claw AI Studio'),
      is_featured: 1,
      is_top_chart: 0,
      rank: null
    };

    const topCharts = [
      { id: 'app-2', name: 'AutoGPT Agent', developer: 'AI Labs', category: 'Autonomous Agents', rating: 4.9, icon: 'https://picsum.photos/seed/autogpt/200/200', rank: 1, ...generateExtendedData('app-2', 'AutoGPT Agent'), is_featured: 0, is_top_chart: 1, banner: null },
      { id: 'app-4', name: 'Vision Processor', developer: 'Neural Inc', category: 'Computer Vision', rating: 4.8, icon: 'https://picsum.photos/seed/vision/200/200', rank: 2, ...generateExtendedData('app-4', 'Vision Processor'), is_featured: 0, is_top_chart: 1, banner: null },
      { id: 'app-5', name: 'Voice Synth Pro', developer: 'AudioAI', category: 'Generative Audio', rating: 4.9, icon: 'https://picsum.photos/seed/voice/200/200', rank: 3, ...generateExtendedData('app-5', 'Voice Synth Pro'), is_featured: 0, is_top_chart: 1, banner: null },
      { id: 'app-9', name: 'Data Scraper AI', developer: 'DataMinds', category: 'Data Processing', rating: 4.8, icon: 'https://picsum.photos/seed/scraper/200/200', rank: 4, ...generateExtendedData('app-9', 'Data Scraper AI'), is_featured: 0, is_top_chart: 1, banner: null },
      { id: 'app-10', name: 'Local LLM Runner', developer: 'EdgeAI', category: 'Infrastructure', rating: 4.6, icon: 'https://picsum.photos/seed/llmrunner/200/200', rank: 5, ...generateExtendedData('app-10', 'Local LLM Runner'), is_featured: 0, is_top_chart: 1, banner: null },
    ];

    const otherApps = [
      { id: 'app-3', name: 'Prompt Engineer', developer: 'PromptCraft', category: 'Developer Tools', rating: 4.5, icon: 'https://picsum.photos/seed/prompt/200/200', ...generateExtendedData('app-3', 'Prompt Engineer'), is_featured: 0, is_top_chart: 0, rank: null, banner: null },
      { id: 'app-6', name: 'Image Gen Pro', developer: 'PixelAI', category: 'Generative Art', rating: 4.6, icon: 'https://picsum.photos/seed/imagegen/200/200', ...generateExtendedData('app-6', 'Image Gen Pro'), is_featured: 0, is_top_chart: 0, rank: null, banner: null },
      { id: 'app-7', name: 'Code Copilot', developer: 'DevAI', category: 'Developer Tools', rating: 4.4, icon: 'https://picsum.photos/seed/copilot/200/200', ...generateExtendedData('app-7', 'Code Copilot'), is_featured: 0, is_top_chart: 0, rank: null, banner: null },
      { id: 'app-8', name: 'Story Weaver', developer: 'NarrativeAI', category: 'Writing', rating: 4.7, icon: 'https://picsum.photos/seed/story/200/200', ...generateExtendedData('app-8', 'Story Weaver'), is_featured: 0, is_top_chart: 0, rank: null, banner: null },
    ];

    const allApps = [featuredApp, ...topCharts, ...otherApps];

    for (const app of allApps) {
      db.run(
        "INSERT INTO app_store_apps (id, name, developer, category, description, banner, icon, rating, rank, reviewsCount, screenshots, version, size, releaseDate, compatibility, ageRating, is_featured, is_top_chart) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [app.id, app.name, app.developer, app.category, app.description, app.banner, app.icon, app.rating, app.rank, app.reviewsCount, app.screenshots, app.version, app.size, app.releaseDate, app.compatibility, app.ageRating, app.is_featured, app.is_top_chart]
      );
    }

    db.run("INSERT INTO app_store_categories (id, title, subtitle) VALUES (?, ?, ?)", ['cat-1', 'Essential AI Tools', 'Must-have applications for your AI workflows']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-1', 'app-2']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-1', 'app-3']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-1', 'app-4']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-1', 'app-5']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-1', 'app-10']);

    db.run("INSERT INTO app_store_categories (id, title, subtitle) VALUES (?, ?, ?)", ['cat-2', 'Generative Creativity', 'Unleash creativity with AI-powered generators']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-2', 'app-6']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-2', 'app-7']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-2', 'app-8']);
    db.run("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)", ['cat-2', 'app-9']);
  }

  const clawCount = db.exec("SELECT COUNT(*) as count FROM claws")[0]?.values[0]?.[0] as number || 0;
  if (clawCount === 0) {
    db.run("INSERT INTO claws (id, name, status, ip, version, os, uptime, cpuUsage, ramUsage, lastSeen, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['claw-001', 'Main Server Claw', 'online', '192.168.1.100', 'v2.1.0', 'Ubuntu 22.04', '14 days, 2 hours', 45, 62, 'Just now', 'Data Center A']);
    db.run("INSERT INTO claw_details (id, kernel, diskUsage, macAddress, connectedDevices, activeTasks) VALUES (?, ?, ?, ?, ?, ?)", ['claw-001', 'Linux 5.15.0-88-generic', 28, '00:1A:2B:3C:4D:5E', 12, 5]);

    db.run("INSERT INTO claws (id, name, status, ip, version, os, uptime, cpuUsage, ramUsage, lastSeen, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['claw-002', 'Office Gateway', 'online', '10.0.0.50', 'v2.1.0', 'Debian 11', '5 days, 12 hours', 12, 34, '2 mins ago', 'NY Office']);
    db.run("INSERT INTO claw_details (id, kernel, diskUsage, macAddress, connectedDevices, activeTasks) VALUES (?, ?, ?, ?, ?, ?)", ['claw-002', 'Linux 5.10.0-21-amd64', 15, '00:1A:2B:3C:4D:5F', 3, 1]);

    db.run("INSERT INTO claws (id, name, status, ip, version, os, uptime, cpuUsage, ramUsage, lastSeen, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['claw-003', 'Home Assistant Node', 'offline', '192.168.50.20', 'v2.0.5', 'Raspberry Pi OS', 'Offline', 0, 0, '2 hours ago', 'Living Room']);
    db.run("INSERT INTO claw_details (id, kernel, diskUsage, macAddress, connectedDevices, activeTasks) VALUES (?, ?, ?, ?, ?, ?)", ['claw-003', 'Linux 6.1.21-v8+', 45, '00:1A:2B:3C:4D:60', 0, 0]);

    db.run("INSERT INTO claws (id, name, status, ip, version, os, uptime, cpuUsage, ramUsage, lastSeen, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['claw-004', 'Edge Worker 1', 'online', '172.16.0.10', 'v2.1.0', 'Alpine Linux', '45 days, 1 hour', 88, 91, 'Just now', 'Edge Node B']);
    db.run("INSERT INTO claw_details (id, kernel, diskUsage, macAddress, connectedDevices, activeTasks) VALUES (?, ?, ?, ?, ?, ?)", ['claw-004', 'Linux 5.15.107-0-lts', 85, '00:1A:2B:3C:4D:61', 25, 12]);
  }

  const channelCount = db.exec("SELECT COUNT(*) as count FROM channels")[0]?.values[0]?.[0] as number || 0;
  if (channelCount === 0) {
    const INITIAL_CHANNELS = [
      {
        id: 'sdkwork_chat',
        name: 'Sdkwork Chat',
        description: 'Connect Claw Studio to Sdkwork Chat for enterprise team collaboration and automated assistance.',
        icon: 'MessageCircle',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
          { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your Sdkwork Chat App Secret' },
          { key: 'verification_token', label: 'Verification Token', type: 'password', placeholder: 'Optional: For event verification', helpText: 'Used to verify requests from Sdkwork Chat.' }
        ],
        setupGuide: [
          'Go to the Sdkwork Open Platform.',
          'Create a Custom App and navigate to "Credentials & Basic Info".',
          'Copy the App ID and App Secret.',
          'Enable the "Bot" feature under "Add Features".',
          'Configure the Event Subscription URL using your OpenClaw webhook endpoint.'
        ]
      },
      {
        id: 'feishu',
        name: '飞书 (Feishu)',
        description: 'Connect Claw Studio to Feishu for enterprise team collaboration and automated assistance.',
        icon: 'MessageCircle',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
          { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your Feishu App Secret' },
          { key: 'verification_token', label: 'Verification Token', type: 'password', placeholder: 'Optional: For event verification', helpText: 'Used to verify requests from Feishu.' }
        ],
        setupGuide: [
          'Go to the Feishu Open Platform (open.feishu.cn).',
          'Create a Custom App and navigate to "Credentials & Basic Info".',
          'Copy the App ID and App Secret.',
          'Enable the "Bot" feature under "Add Features".',
          'Configure the Event Subscription URL using your OpenClaw webhook endpoint.'
        ]
      },
      {
        id: 'qq',
        name: 'QQ Bot (QQ机器人)',
        description: 'Integrate with QQ Guilds or Groups to interact with users directly in QQ.',
        icon: 'Smile',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'app_id', label: 'Bot App ID', type: 'text', placeholder: '102030405' },
          { key: 'token', label: 'Bot Token', type: 'password', placeholder: 'Your QQ Bot Token' },
          { key: 'secret', label: 'Bot Secret', type: 'password', placeholder: 'Your QQ Bot Secret' }
        ],
        setupGuide: [
          'Go to the QQ Open Platform (q.qq.com).',
          'Create a new Bot application.',
          'Navigate to the Development settings to get your App ID, Token, and Secret.',
          'Add the bot to your QQ Guild for testing.'
        ]
      },
      {
        id: 'dingtalk',
        name: '钉钉 (DingTalk)',
        description: 'Connect to DingTalk for enterprise automation, notifications, and chat.',
        icon: 'Zap',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'app_key', label: 'AppKey', type: 'text', placeholder: 'dingxxxxxxxxxxxx' },
          { key: 'app_secret', label: 'AppSecret', type: 'password', placeholder: 'Your DingTalk App Secret' }
        ],
        setupGuide: [
          'Go to the DingTalk Developer Platform (open-dev.dingtalk.com).',
          'Create an internal enterprise application.',
          'Add the "Robot" feature to your application.',
          'Copy the AppKey and AppSecret from the App Credentials page.'
        ]
      },
      {
        id: 'wecom',
        name: '企业微信 (WeCom)',
        description: 'Integrate with WeCom for internal company assistance and workflow automation.',
        icon: 'Building2',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'corp_id', label: 'CorpID', type: 'text', placeholder: 'wwxxxxxxxxxxxx' },
          { key: 'agent_id', label: 'AgentId', type: 'text', placeholder: '1000001' },
          { key: 'secret', label: 'Secret', type: 'password', placeholder: 'Your WeCom App Secret' }
        ],
        setupGuide: [
          'Go to the WeCom Admin Console (work.weixin.qq.com).',
          'Navigate to "App Management" and create a self-built app.',
          'Get the AgentId and Secret from the app details page.',
          'Get the CorpID from "My Enterprise" > "Enterprise Info".'
        ]
      },
      {
        id: 'telegram',
        name: 'Telegram Bot',
        description: 'Connect your OpenClaw agent to a Telegram bot to interact via chat.',
        icon: 'Send',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz', helpText: 'The HTTP API token provided by BotFather.' }
        ],
        setupGuide: [
          'Open Telegram and search for @BotFather.',
          'Send the /newbot command and follow the prompts.',
          'Copy the HTTP API Token provided at the end.',
          'Paste the token here and save.'
        ]
      },
      {
        id: 'discord',
        name: 'Discord Integration',
        description: 'Add OpenClaw to your Discord server to manage tasks and answer questions.',
        icon: 'MessageSquare',
        status: 'connected',
        enabled: 1,
        fields: [
          { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'MTE... (Your Discord Bot Token)', value: '************************' },
          { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Application ID', value: '112233445566778899' }
        ],
        setupGuide: [
          'Go to the Discord Developer Portal.',
          'Click "New Application" and give it a name.',
          'Navigate to the "Bot" tab and click "Add Bot".',
          'Click "Reset Token" and copy the new token.',
          'Enable "Message Content Intent" under Privileged Gateway Intents.'
        ]
      },
      {
        id: 'slack',
        name: 'Slack App',
        description: 'Integrate with Slack workspaces for team collaboration and agent assistance.',
        icon: 'Hash',
        status: 'not_configured',
        enabled: 0,
        fields: [
          { key: 'bot_token', label: 'Bot User OAuth Token', type: 'password', placeholder: 'xoxb-...' },
          { key: 'app_token', label: 'App-Level Token', type: 'password', placeholder: 'xapp-...' }
        ],
        setupGuide: [
          'Go to api.slack.com/apps and create a new app.',
          'Under "Socket Mode", enable it and generate an App-Level Token (xapp-...).',
          'Under "OAuth & Permissions", add necessary bot token scopes (chat:write, etc.).',
          'Install the app to your workspace to get the Bot User OAuth Token (xoxb-...).'
        ]
      },
      {
        id: 'webhook',
        name: 'Custom Webhook',
        description: 'Send and receive events via standard HTTP webhooks for custom integrations.',
        icon: 'Webhook',
        status: 'connected',
        enabled: 1,
        fields: [
          { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-domain.com/webhook', value: 'https://api.example.com/openclaw/callback' },
          { key: 'secret', label: 'Secret Key', type: 'password', placeholder: 'Optional signing secret', value: '********' }
        ],
        setupGuide: [
          'Provide an HTTPS URL that accepts POST requests.',
          'OpenClaw will send JSON payloads to this URL for every event.',
          'Optionally provide a Secret Key to verify webhook signatures via the X-OpenClaw-Signature header.'
        ]
      }
    ];

    for (const channel of INITIAL_CHANNELS) {
      db.run("INSERT INTO channels (id, name, description, icon, status, enabled, setupGuide) VALUES (?, ?, ?, ?, ?, ?, ?)", [channel.id, channel.name, channel.description, channel.icon, channel.status, channel.enabled ? 1 : 0, JSON.stringify(channel.setupGuide)]);
      for (let i = 0; i < channel.fields.length; i++) {
        const field = channel.fields[i];
        db.run("INSERT INTO channel_fields (id, channel_id, key, label, type, placeholder, value, helpText) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [`${channel.id}-field-${i}`, channel.id, field.key, field.label, field.type, field.placeholder || null, (field as any).value || null, field.helpText || null]);
      }
    }
  }
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: any[] = []): any {
  const results = queryAll(sql, params);
  return results[0] || null;
}

function run(sql: string, params: any[] = []): void {
  db.run(sql, params);
}

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = 3001;

  app.use(express.json());

  app.get("/api/devices", (req, res) => {
    const devices = queryAll("SELECT * FROM devices ORDER BY created_at DESC");
    res.json(devices);
  });

  app.post("/api/devices", (req, res) => {
    const { name } = req.body;
    const id = "claw-" + Math.random().toString(36).substr(2, 6);
    const ip = `192.168.1.${Math.floor(Math.random() * 200) + 20}`;
    const battery = Math.floor(Math.random() * 40) + 60;
    run("INSERT INTO devices (id, name, status, battery, ip_address) VALUES (?, ?, ?, ?, ?)", [id, name, "online", battery, ip]);
    const newDevice = queryOne("SELECT * FROM devices WHERE id = ?", [id]);
    res.json(newDevice);
  });

  app.delete("/api/devices/:id", (req, res) => {
    const { id } = req.params;
    run("DELETE FROM devices WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.get("/api/skills", (req, res) => {
    const skills = queryAll("SELECT * FROM skills");
    res.json(skills);
  });

  app.get("/api/skills/:id", (req, res) => {
    const { id } = req.params;
    const skill = queryOne("SELECT * FROM skills WHERE id = ?", [id]);
    if (skill) {
      res.json(skill);
    } else {
      res.status(404).json({ error: "Skill not found" });
    }
  });

  app.get("/api/skills/:id/reviews", (req, res) => {
    const { id } = req.params;
    const reviews = queryAll("SELECT * FROM reviews WHERE skill_id = ? ORDER BY created_at DESC", [id]);
    res.json(reviews);
  });

  app.get("/api/packs", (req, res) => {
    const packs = queryAll("SELECT * FROM skill_packs");
    res.json(packs);
  });

  app.get("/api/packs/:id", (req, res) => {
    const { id } = req.params;
    const pack = queryOne("SELECT * FROM skill_packs WHERE id = ?", [id]);
    if (pack) {
      const skills = queryAll(`
        SELECT s.*
        FROM skills s
        JOIN skill_pack_items spi ON s.id = spi.skill_id
        WHERE spi.pack_id = ?
      `, [id]);
      res.json({ ...pack, skills });
    } else {
      res.status(404).json({ error: "Pack not found" });
    }
  });

  app.get("/api/devices/:id/skills", (req, res) => {
    const { id } = req.params;
    const skills = queryAll(`
      SELECT s.*, i.installed_at
      FROM skills s
      JOIN installations i ON s.id = i.skill_id
      WHERE i.device_id = ?
    `, [id]);
    res.json(skills);
  });

  app.post("/api/installations", (req, res) => {
    const { device_id, skill_id } = req.body;
    try {
      run("INSERT INTO installations (device_id, skill_id) VALUES (?, ?)", [device_id, skill_id]);
      run("UPDATE skills SET downloads = downloads + 1 WHERE id = ?", [skill_id]);
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
        const skills = queryAll("SELECT skill_id FROM skill_pack_items WHERE pack_id = ?", [pack_id]) as { skill_id: string }[];
        skillsToInstall = skills.map(s => s.skill_id);
      }

      for (const skillId of skillsToInstall) {
        try {
          run("INSERT OR IGNORE INTO installations (device_id, skill_id) VALUES (?, ?)", [device_id, skillId]);
          run("UPDATE skills SET downloads = downloads + 1 WHERE id = ?", [skillId]);
        } catch (e) {}
      }

      run("UPDATE skill_packs SET downloads = downloads + 1 WHERE id = ?", [pack_id]);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Installation failed" });
    }
  });

  app.delete("/api/installations", (req, res) => {
    const { device_id, skill_id } = req.body;
    run("DELETE FROM installations WHERE device_id = ? AND skill_id = ?", [device_id, skill_id]);
    res.json({ success: true });
  });

  app.get("/api/instances", (req, res) => {
    const instances = queryAll("SELECT * FROM instances");
    res.json(instances);
  });

  app.get("/api/instances/:id", (req, res) => {
    const { id } = req.params;
    const instance = queryOne("SELECT * FROM instances WHERE id = ?", [id]);
    if (instance) {
      res.json(instance);
    } else {
      res.status(404).json({ error: "Instance not found" });
    }
  });

  app.post("/api/instances/:id/start", (req, res) => {
    const { id } = req.params;
    run("UPDATE instances SET status = 'online' WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.post("/api/instances/:id/stop", (req, res) => {
    const { id } = req.params;
    run("UPDATE instances SET status = 'offline' WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.post("/api/instances/:id/restart", (req, res) => {
    const { id } = req.params;
    run("UPDATE instances SET status = 'online' WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.get("/api/instances/:id/config", (req, res) => {
    const { id } = req.params;
    const config = queryOne("SELECT * FROM instance_configs WHERE instance_id = ?", [id]);
    if (config) {
      res.json({
        port: config.port,
        sandbox: Boolean(config.sandbox),
        autoUpdate: Boolean(config.autoUpdate),
        logLevel: config.logLevel,
        corsOrigins: config.corsOrigins
      });
    } else {
      res.status(404).json({ error: "Config not found" });
    }
  });

  app.put("/api/instances/:id/config", (req, res) => {
    const { id } = req.params;
    const { port, sandbox, autoUpdate, logLevel, corsOrigins } = req.body;
    run(`
      UPDATE instance_configs
      SET port = ?, sandbox = ?, autoUpdate = ?, logLevel = ?, corsOrigins = ?
      WHERE instance_id = ?
    `, [port, sandbox ? 1 : 0, autoUpdate ? 1 : 0, logLevel, corsOrigins, id]);
    res.json({ success: true });
  });

  app.get("/api/instances/:id/token", (req, res) => {
    const { id } = req.params;
    const tokenRecord = queryOne("SELECT token FROM instance_tokens WHERE instance_id = ?", [id]);
    if (tokenRecord) {
      res.json({ token: tokenRecord.token });
    } else {
      res.status(404).json({ error: "Token not found" });
    }
  });

  app.get("/api/instances/:instanceId/tasks", (req, res) => {
    const { instanceId } = req.params;
    const tasks = queryAll("SELECT * FROM tasks WHERE instance_id = ? OR instance_id IS NULL", [instanceId]);
    res.json(tasks);
  });

  app.post("/api/instances/:instanceId/tasks", (req, res) => {
    const { instanceId } = req.params;
    const { name, schedule, actionType, status } = req.body;
    const id = `task-${Date.now()}`;
    run("INSERT INTO tasks (id, instance_id, name, schedule, actionType, status, nextRun) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id, instanceId, name, schedule, actionType, status || 'active', 'In 5 minutes'
    ]);
    const newTask = queryOne("SELECT * FROM tasks WHERE id = ?", [id]);
    res.json(newTask);
  });

  app.put("/api/tasks/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    run("UPDATE tasks SET status = ? WHERE id = ?", [status, id]);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    run("DELETE FROM tasks WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.get("/api/settings/profile", (req, res) => {
    const profile = queryOne("SELECT firstName, lastName, email, avatarUrl FROM user_profile WHERE id = 'user-1'");
    res.json(profile);
  });

  app.put("/api/settings/profile", (req, res) => {
    const { firstName, lastName, email, avatarUrl } = req.body;
    run("UPDATE user_profile SET firstName = ?, lastName = ?, email = ?, avatarUrl = ? WHERE id = 'user-1'", [firstName, lastName, email, avatarUrl]);
    res.json({ success: true });
  });

  app.get("/api/settings/preferences", (req, res) => {
    const record = queryOne("SELECT preferences FROM user_preferences WHERE id = 'user-1'");
    if (record) {
      res.json(JSON.parse(record.preferences));
    } else {
      res.status(404).json({ error: "Preferences not found" });
    }
  });

  app.put("/api/settings/preferences", (req, res) => {
    const newPrefs = req.body;
    const record = queryOne("SELECT preferences FROM user_preferences WHERE id = 'user-1'");
    let currentPrefs = {};
    if (record) {
      currentPrefs = JSON.parse(record.preferences);
    }
    const updatedPrefs = {
      ...currentPrefs,
      ...newPrefs,
      general: { ...(currentPrefs as any).general, ...newPrefs.general },
      notifications: { ...(currentPrefs as any).notifications, ...newPrefs.notifications },
      privacy: { ...(currentPrefs as any).privacy, ...newPrefs.privacy },
      security: { ...(currentPrefs as any).security, ...newPrefs.security }
    };
    run("UPDATE user_preferences SET preferences = ? WHERE id = 'user-1'", [JSON.stringify(updatedPrefs)]);
    res.json(updatedPrefs);
  });

  app.get("/api/community/posts", (req, res) => {
    const { category, query } = req.query;
    let sql = "SELECT * FROM community_posts";
    const params: any[] = [];
    const conditions: string[] = [];

    if (category && category !== 'latest' && category !== 'popular') {
      conditions.push("category = ?");
      params.push(category);
    }

    if (query) {
      conditions.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
      const likeQuery = `%${query}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    if (category === 'popular') {
      sql += " ORDER BY likes DESC";
    } else {
      sql += " ORDER BY created_at DESC";
    }

    const posts = queryAll(sql, params).map((p: any) => ({
      ...p,
      tags: JSON.parse(p.tags),
      author: {
        name: p.author_name,
        avatar: p.author_avatar,
        role: p.author_role,
        bio: p.author_bio
      },
      stats: {
        likes: p.likes,
        comments: p.comments,
        views: p.views
      }
    }));
    res.json(posts);
  });

  app.get("/api/community/posts/:id", (req, res) => {
    const { id } = req.params;
    const post = queryOne("SELECT * FROM community_posts WHERE id = ?", [id]);
    if (post) {
      res.json({
        ...post,
        tags: JSON.parse(post.tags),
        author: {
          name: post.author_name,
          avatar: post.author_avatar,
          role: post.author_role,
          bio: post.author_bio
        },
        stats: {
          likes: post.likes,
          comments: post.comments,
          views: post.views
        }
      });
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  });

  app.get("/api/community/posts/:id/comments", (req, res) => {
    const { id } = req.params;
    const comments = queryAll("SELECT * FROM community_comments WHERE post_id = ? ORDER BY created_at ASC", [id]).map((c: any) => ({
      ...c,
      author: {
        name: c.author_name,
        avatar: c.author_avatar
      }
    }));
    res.json(comments);
  });

  app.post("/api/community/posts/:id/like", (req, res) => {
    const { id } = req.params;
    run("UPDATE community_posts SET likes = likes + 1 WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.post("/api/community/posts/:id/comments", (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const commentId = `comment-${Date.now()}`;
    run("INSERT INTO community_comments (id, post_id, author_name, author_avatar, content) VALUES (?, ?, ?, ?, ?)", [
      commentId, id, 'Current User', 'https://picsum.photos/seed/user/100/100', content
    ]);
    run("UPDATE community_posts SET comments = comments + 1 WHERE id = ?", [id]);
    const newComment = queryOne("SELECT * FROM community_comments WHERE id = ?", [commentId]);
    res.json({
      ...newComment,
      author: {
        name: newComment.author_name,
        avatar: newComment.author_avatar
      }
    });
  });

  app.post("/api/community/posts", (req, res) => {
    const { title, content, category, tags, coverImage } = req.body;
    const id = `post-${Date.now()}`;
    run("INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, category, tags, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      id, title, content, 'Current User', 'https://picsum.photos/seed/user/100/100', 'Member', category, JSON.stringify(tags), coverImage
    ]);
    const newPost = queryOne("SELECT * FROM community_posts WHERE id = ?", [id]);
    res.json({
      ...newPost,
      tags: JSON.parse(newPost.tags),
      author: {
        name: newPost.author_name,
        avatar: newPost.author_avatar,
        role: newPost.author_role,
        bio: newPost.author_bio
      },
      stats: {
        likes: newPost.likes,
        comments: newPost.comments,
        views: newPost.views
      }
    });
  });

  app.get("/api/github/repos", (req, res) => {
    const repos = queryAll("SELECT * FROM github_repos LIMIT 100").map((r: any) => ({
      ...r,
      tags: JSON.parse(r.tags)
    }));
    res.json(repos);
  });

  app.get("/api/huggingface/models", (req, res) => {
    const models = queryAll("SELECT * FROM huggingface_models LIMIT 100").map((m: any) => ({
      ...m,
      tags: JSON.parse(m.tags)
    }));
    res.json(models);
  });

  app.get("/api/appstore/featured", (req, res) => {
    const app = queryOne("SELECT * FROM app_store_apps WHERE is_featured = 1 LIMIT 1");
    if (app) {
      res.json({ ...app, screenshots: JSON.parse(app.screenshots) });
    } else {
      res.status(404).json({ error: "Featured app not found" });
    }
  });

  app.get("/api/appstore/topcharts", (req, res) => {
    const apps = queryAll("SELECT * FROM app_store_apps WHERE is_top_chart = 1 ORDER BY rank ASC").map((a: any) => ({
      ...a,
      screenshots: JSON.parse(a.screenshots)
    }));
    res.json(apps);
  });

  app.get("/api/appstore/categories", (req, res) => {
    const categories = queryAll("SELECT * FROM app_store_categories") as any[];
    const result = categories.map(cat => {
      const apps = queryAll(`
        SELECT a.*
        FROM app_store_apps a
        JOIN app_store_category_apps ca ON a.id = ca.app_id
        WHERE ca.category_id = ?
      `, [cat.id]).map((a: any) => ({
        ...a,
        screenshots: JSON.parse(a.screenshots)
      }));
      return { ...cat, apps };
    });
    res.json(result);
  });

  app.get("/api/appstore/apps/:id", (req, res) => {
    const { id } = req.params;
    const app = queryOne("SELECT * FROM app_store_apps WHERE id = ?", [id]);
    if (app) {
      res.json({ ...app, screenshots: JSON.parse(app.screenshots) });
    } else {
      res.status(404).json({ error: "App not found" });
    }
  });

  app.get("/api/claws", (req, res) => {
    const claws = queryAll("SELECT * FROM claws");
    res.json(claws);
  });

  app.get("/api/claws/:id", (req, res) => {
    const { id } = req.params;
    const claw = queryOne("SELECT * FROM claws WHERE id = ?", [id]);
    if (claw) {
      res.json(claw);
    } else {
      res.status(404).json({ error: "Claw not found" });
    }
  });

  app.get("/api/claws/:id/detail", (req, res) => {
    const { id } = req.params;
    const claw = queryOne(`
      SELECT c.*, d.kernel, d.diskUsage, d.macAddress, d.connectedDevices, d.activeTasks
      FROM claws c
      JOIN claw_details d ON c.id = d.id
      WHERE c.id = ?
    `, [id]);
    if (claw) {
      res.json(claw);
    } else {
      res.status(404).json({ error: "Claw detail not found" });
    }
  });

  app.get("/api/instances/:instanceId/channels", (req, res) => {
    const { instanceId } = req.params;
    const channels = queryAll("SELECT * FROM channels WHERE instance_id = ? OR instance_id IS NULL", [instanceId]) as any[];
    const result = channels.map(channel => {
      const fields = queryAll("SELECT * FROM channel_fields WHERE channel_id = ?", [channel.id]);
      return {
        ...channel,
        enabled: Boolean(channel.enabled),
        setupGuide: JSON.parse(channel.setupGuide),
        fields
      };
    });
    res.json(result);
  });

  app.put("/api/channels/:id/status", (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    run("UPDATE channels SET enabled = ?, status = ? WHERE id = ?", [enabled ? 1 : 0, enabled ? 'connected' : 'disconnected', id]);
    res.json({ success: true });
  });

  app.put("/api/channels/:id/config", (req, res) => {
    const { id } = req.params;
    const configData = req.body;

    for (const [key, value] of Object.entries(configData)) {
      run("UPDATE channel_fields SET value = ? WHERE channel_id = ? AND key = ?", [value, id, key]);
    }
    run("UPDATE channels SET status = 'connected', enabled = 1 WHERE id = ?", [id]);

    res.json({ success: true });
  });

  app.delete("/api/channels/:id/config", (req, res) => {
    const { id } = req.params;
    run("UPDATE channel_fields SET value = NULL WHERE channel_id = ?", [id]);
    run("UPDATE channels SET status = 'not_configured', enabled = 0 WHERE id = ?", [id]);
    res.json({ success: true });
  });

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
