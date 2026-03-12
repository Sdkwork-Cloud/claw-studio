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
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    actionType TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    lastRun TEXT,
    nextRun TEXT
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
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    status TEXT DEFAULT 'not_configured',
    enabled BOOLEAN DEFAULT 0,
    setupGuide TEXT
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

const instanceCount = db.prepare("SELECT COUNT(*) as count FROM instances").get() as { count: number };
if (instanceCount.count === 0) {
  const insertInstance = db.prepare("INSERT INTO instances (id, name, type, iconType, status, version, uptime, ip, cpu, memory, totalMemory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertConfig = db.prepare("INSERT INTO instance_configs (instance_id, port, sandbox, autoUpdate, logLevel, corsOrigins) VALUES (?, ?, ?, ?, ?, ?)");
  const insertToken = db.prepare("INSERT INTO instance_tokens (instance_id, token) VALUES (?, ?)");

  insertInstance.run('local-mac', 'MacBook Pro (Local)', 'macOS Native', 'apple', 'online', 'v0.2.1', '5d 12h', '127.0.0.1', 12, 35, '32 GB');
  insertConfig.run('local-mac', '18789', 1, 0, 'info', '*');
  insertToken.run('local-mac', 'oc_token_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c');

  insertInstance.run('home-server', 'Home NAS Gateway', 'Docker Container', 'box', 'online', 'v0.2.1', '32d 4h', '192.168.1.100', 45, 68, '16 GB');
  insertConfig.run('home-server', '18789', 1, 1, 'warn', 'http://localhost:3000');
  insertToken.run('home-server', 'oc_token_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p');

  insertInstance.run('aws-node', 'AWS EC2 Node', 'Ubuntu Linux', 'server', 'offline', 'v0.2.0', '-', '3.14.15.92', 0, 0, '64 GB');
  insertConfig.run('aws-node', '8080', 1, 1, 'error', '*');
  insertToken.run('aws-node', 'oc_token_q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6');
}

const taskCount = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
if (taskCount.count === 0) {
  const insertTask = db.prepare("INSERT INTO tasks (id, name, schedule, actionType, status, lastRun, nextRun) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertTask.run('task-1', 'Daily System Check', '0 0 * * *', 'skill', 'active', '2 hours ago', 'in 22 hours');
  insertTask.run('task-2', 'Weekly Report', '0 9 * * 1', 'message', 'paused', '3 days ago', '-');
}

const userProfileCount = db.prepare("SELECT COUNT(*) as count FROM user_profile").get() as { count: number };
if (userProfileCount.count === 0) {
  db.prepare("INSERT INTO user_profile (id, firstName, lastName, email) VALUES (?, ?, ?, ?)").run('user-1', 'John', 'Doe', 'john.doe@example.com');
  
  const defaultPrefs = {
    general: { launchOnStartup: true, startMinimized: false },
    notifications: { systemUpdates: true, taskFailures: true, securityAlerts: true, taskCompletions: false, newMessages: true },
    privacy: { shareUsageData: true, personalizedRecommendations: true },
    security: { twoFactorAuth: false, loginAlerts: true }
  };
  db.prepare("INSERT INTO user_preferences (id, preferences) VALUES (?, ?)").run('user-1', JSON.stringify(defaultPrefs));
}

const communityPostCount = db.prepare("SELECT COUNT(*) as count FROM community_posts").get() as { count: number };
if (communityPostCount.count === 0) {
  const insertPost = db.prepare("INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, author_bio, category, tags, likes, comments, views, created_at, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertComment = db.prepare("INSERT INTO community_comments (id, post_id, author_name, author_avatar, content, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, ?)");

  insertPost.run(
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
  );

  insertPost.run(
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
  );

  insertPost.run(
    'post-3',
    'Announcing OpenClaw v2.0: What\'s New',
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
  );

  insertComment.run(
    'comment-1',
    'post-1',
    'Sarah Jenkins',
    'https://picsum.photos/seed/sarah/100/100',
    'This is exactly what I needed! The CLI installation method is so much faster.',
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    12
  );

  insertComment.run(
    'comment-2',
    'post-1',
    'David Kim',
    'https://picsum.photos/seed/david/100/100',
    'Quick question: Does the starter pack include the vision processing modules by default?',
    new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    3
  );
}

const githubRepoCount = db.prepare("SELECT COUNT(*) as count FROM github_repos").get() as { count: number };
if (githubRepoCount.count === 0) {
  const insertRepo = db.prepare("INSERT INTO github_repos (id, name, author, description, stars, forks, tags, iconUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const bases = [
    { name: 'llama.cpp', author: 'ggerganov', tags: ['C++', 'LLM', 'Inference'] },
    { name: 'stable-diffusion-webui', author: 'AUTOMATIC1111', tags: ['Python', 'Stable Diffusion', 'UI'] },
    { name: 'LangChain', author: 'langchain-ai', tags: ['Python', 'LLM', 'Agents'] },
    { name: 'AutoGPT', author: 'Significant-Gravitas', tags: ['Python', 'Autonomous', 'GPT-4'] },
    { name: 'ollama', author: 'ollama', tags: ['Go', 'LLM', 'Local'] },
    { name: 'whisper', author: 'openai', tags: ['Python', 'Speech Recognition', 'Audio'] }
  ];

  const transaction = db.transaction(() => {
    for (let i = 0; i < 1000; i++) {
      const base = bases[i % bases.length];
      insertRepo.run(
        `gh-${i}`,
        `${base.name}-${i}`,
        base.author,
        `High-performance port of ${base.name} optimized for local execution. Instance #${i}.`,
        Math.floor(Math.random() * 100000) + 1000,
        Math.floor(Math.random() * 20000) + 100,
        JSON.stringify(base.tags),
        `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 10000000)}?s=200&v=4`
      );
    }
  });
  transaction();
}

const huggingfaceModelCount = db.prepare("SELECT COUNT(*) as count FROM huggingface_models").get() as { count: number };
if (huggingfaceModelCount.count === 0) {
  const insertModel = db.prepare("INSERT INTO huggingface_models (id, name, author, description, downloads, tags, iconUrl) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const bases = [
    { name: 'Llama-3-8B-Instruct', author: 'meta-llama', tags: ['Text Generation', 'LLM', 'Instruct'] },
    { name: 'stable-diffusion-xl-base-1.0', author: 'stabilityai', tags: ['Text-to-Image', 'Diffusion'] },
    { name: 'Mixtral-8x7B-Instruct-v0.1', author: 'mistralai', tags: ['Text Generation', 'MoE'] },
    { name: 'whisper-large-v3', author: 'openai', tags: ['Speech Recognition', 'Audio'] },
    { name: 'Qwen1.5-14B-Chat', author: 'Qwen', tags: ['Text Generation', 'Chat', 'Chinese'] },
    { name: 'all-MiniLM-L6-v2', author: 'sentence-transformers', tags: ['Sentence Similarity', 'Embeddings'] }
  ];

  const transaction = db.transaction(() => {
    for (let i = 0; i < 1000; i++) {
      const base = bases[i % bases.length];
      insertModel.run(
        `hf-${i}`,
        `${base.name}-v${Math.floor(i/10)}.${i%10}`,
        base.author,
        `State-of-the-art model for ${base.tags[0]}. This is variant #${i} optimized for specific use cases.`,
        Math.floor(Math.random() * 50000000) + 100000,
        JSON.stringify(base.tags),
        'https://huggingface.co/front/assets/huggingface_logo-noborder.svg'
      );
    }
  });
  transaction();
}

const appStoreCount = db.prepare("SELECT COUNT(*) as count FROM app_store_apps").get() as { count: number };
if (appStoreCount.count === 0) {
  const insertApp = db.prepare("INSERT INTO app_store_apps (id, name, developer, category, description, banner, icon, rating, rank, reviewsCount, screenshots, version, size, releaseDate, compatibility, ageRating, is_featured, is_top_chart) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertCategory = db.prepare("INSERT INTO app_store_categories (id, title, subtitle) VALUES (?, ?, ?)");
  const insertCategoryApp = db.prepare("INSERT INTO app_store_category_apps (category_id, app_id) VALUES (?, ?)");

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

  const transaction = db.transaction(() => {
    for (const app of allApps) {
      insertApp.run(app.id, app.name, app.developer, app.category, app.description, app.banner, app.icon, app.rating, app.rank, app.reviewsCount, app.screenshots, app.version, app.size, app.releaseDate, app.compatibility, app.ageRating, app.is_featured, app.is_top_chart);
    }

    insertCategory.run('cat-1', 'Essential AI Tools', 'Must-have applications for your AI workflows');
    insertCategoryApp.run('cat-1', 'app-2');
    insertCategoryApp.run('cat-1', 'app-3');
    insertCategoryApp.run('cat-1', 'app-4');
    insertCategoryApp.run('cat-1', 'app-5');
    insertCategoryApp.run('cat-1', 'app-10');

    insertCategory.run('cat-2', 'Generative Creativity', 'Unleash creativity with AI-powered generators');
    insertCategoryApp.run('cat-2', 'app-6');
    insertCategoryApp.run('cat-2', 'app-7');
    insertCategoryApp.run('cat-2', 'app-8');
    insertCategoryApp.run('cat-2', 'app-9');
  });
  transaction();
}

const clawCount = db.prepare("SELECT COUNT(*) as count FROM claws").get() as { count: number };
if (clawCount.count === 0) {
  const insertClaw = db.prepare("INSERT INTO claws (id, name, status, ip, version, os, uptime, cpuUsage, ramUsage, lastSeen, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertClawDetail = db.prepare("INSERT INTO claw_details (id, kernel, diskUsage, macAddress, connectedDevices, activeTasks) VALUES (?, ?, ?, ?, ?, ?)");

  const transaction = db.transaction(() => {
    insertClaw.run('claw-001', 'Main Server Claw', 'online', '192.168.1.100', 'v2.1.0', 'Ubuntu 22.04', '14 days, 2 hours', 45, 62, 'Just now', 'Data Center A');
    insertClawDetail.run('claw-001', 'Linux 5.15.0-88-generic', 28, '00:1A:2B:3C:4D:5E', 12, 5);

    insertClaw.run('claw-002', 'Office Gateway', 'online', '10.0.0.50', 'v2.1.0', 'Debian 11', '5 days, 12 hours', 12, 34, '2 mins ago', 'NY Office');
    insertClawDetail.run('claw-002', 'Linux 5.10.0-21-amd64', 15, '00:1A:2B:3C:4D:5F', 3, 1);

    insertClaw.run('claw-003', 'Home Assistant Node', 'offline', '192.168.50.20', 'v2.0.5', 'Raspberry Pi OS', 'Offline', 0, 0, '2 hours ago', 'Living Room');
    insertClawDetail.run('claw-003', 'Linux 6.1.21-v8+', 45, '00:1A:2B:3C:4D:60', 0, 0);

    insertClaw.run('claw-004', 'Edge Worker 1', 'online', '172.16.0.10', 'v2.1.0', 'Alpine Linux', '45 days, 1 hour', 88, 91, 'Just now', 'Edge Node B');
    insertClawDetail.run('claw-004', 'Linux 5.15.107-0-lts', 85, '00:1A:2B:3C:4D:61', 25, 12);
  });
  transaction();
}

const channelCount = db.prepare("SELECT COUNT(*) as count FROM channels").get() as { count: number };
if (channelCount.count === 0) {
  const insertChannel = db.prepare("INSERT INTO channels (id, name, description, icon, status, enabled, setupGuide) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertField = db.prepare("INSERT INTO channel_fields (id, channel_id, key, label, type, placeholder, value, helpText) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

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

  const transaction = db.transaction(() => {
    for (const channel of INITIAL_CHANNELS) {
      insertChannel.run(channel.id, channel.name, channel.description, channel.icon, channel.status, channel.enabled ? 1 : 0, JSON.stringify(channel.setupGuide));
      for (let i = 0; i < channel.fields.length; i++) {
        const field = channel.fields[i] as any;
        insertField.run(`${channel.id}-field-${i}`, channel.id, field.key, field.label, field.type, field.placeholder || null, field.value || null, field.helpText || null);
      }
    }
  });
  transaction();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    const pack = db.prepare("SELECT * FROM skill_packs WHERE id = ?").get(id);
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

  // Instances API
  app.get("/api/instances", (req, res) => {
    const instances = db.prepare("SELECT * FROM instances").all();
    res.json(instances);
  });

  app.get("/api/instances/:id", (req, res) => {
    const { id } = req.params;
    const instance = db.prepare("SELECT * FROM instances WHERE id = ?").get(id);
    if (instance) {
      res.json(instance);
    } else {
      res.status(404).json({ error: "Instance not found" });
    }
  });

  app.post("/api/instances/:id/start", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE instances SET status = 'online' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/instances/:id/stop", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE instances SET status = 'offline' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/instances/:id/restart", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE instances SET status = 'online' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/instances/:id/config", (req, res) => {
    const { id } = req.params;
    const config = db.prepare("SELECT * FROM instance_configs WHERE instance_id = ?").get(id) as any;
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
    db.prepare(`
      UPDATE instance_configs 
      SET port = ?, sandbox = ?, autoUpdate = ?, logLevel = ?, corsOrigins = ? 
      WHERE instance_id = ?
    `).run(port, sandbox ? 1 : 0, autoUpdate ? 1 : 0, logLevel, corsOrigins, id);
    res.json({ success: true });
  });

  app.get("/api/instances/:id/token", (req, res) => {
    const { id } = req.params;
    const tokenRecord = db.prepare("SELECT token FROM instance_tokens WHERE instance_id = ?").get(id) as any;
    if (tokenRecord) {
      res.json({ token: tokenRecord.token });
    } else {
      res.status(404).json({ error: "Token not found" });
    }
  });

  // Tasks API
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks").all();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { name, schedule, actionType, status } = req.body;
    const id = `task-${Date.now()}`;
    db.prepare("INSERT INTO tasks (id, name, schedule, actionType, status, nextRun) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, name, schedule, actionType, status || 'active', 'In 5 minutes'
    );
    const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    res.json(newTask);
  });

  app.put("/api/tasks/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Settings API
  app.get("/api/settings/profile", (req, res) => {
    const profile = db.prepare("SELECT firstName, lastName, email, avatarUrl FROM user_profile WHERE id = 'user-1'").get();
    res.json(profile);
  });

  app.put("/api/settings/profile", (req, res) => {
    const { firstName, lastName, email, avatarUrl } = req.body;
    db.prepare("UPDATE user_profile SET firstName = ?, lastName = ?, email = ?, avatarUrl = ? WHERE id = 'user-1'").run(firstName, lastName, email, avatarUrl);
    res.json({ success: true });
  });

  app.get("/api/settings/preferences", (req, res) => {
    const record = db.prepare("SELECT preferences FROM user_preferences WHERE id = 'user-1'").get() as any;
    if (record) {
      res.json(JSON.parse(record.preferences));
    } else {
      res.status(404).json({ error: "Preferences not found" });
    }
  });

  app.put("/api/settings/preferences", (req, res) => {
    const newPrefs = req.body;
    const record = db.prepare("SELECT preferences FROM user_preferences WHERE id = 'user-1'").get() as any;
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
    db.prepare("UPDATE user_preferences SET preferences = ? WHERE id = 'user-1'").run(JSON.stringify(updatedPrefs));
    res.json(updatedPrefs);
  });

  // Community API
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

    const posts = db.prepare(sql).all(...params).map((p: any) => ({
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
    const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(id) as any;
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
    const comments = db.prepare("SELECT * FROM community_comments WHERE post_id = ? ORDER BY created_at ASC").all(id).map((c: any) => ({
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
    db.prepare("UPDATE community_posts SET likes = likes + 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/community/posts/:id/comments", (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const commentId = `comment-${Date.now()}`;
    db.prepare("INSERT INTO community_comments (id, post_id, author_name, author_avatar, content) VALUES (?, ?, ?, ?, ?)").run(
      commentId, id, 'Current User', 'https://picsum.photos/seed/user/100/100', content
    );
    db.prepare("UPDATE community_posts SET comments = comments + 1 WHERE id = ?").run(id);
    const newComment = db.prepare("SELECT * FROM community_comments WHERE id = ?").get(commentId) as any;
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
    db.prepare("INSERT INTO community_posts (id, title, content, author_name, author_avatar, author_role, category, tags, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, title, content, 'Current User', 'https://picsum.photos/seed/user/100/100', 'Member', category, JSON.stringify(tags), coverImage
    );
    const newPost = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(id) as any;
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

  // GitHub API
  app.get("/api/github/repos", (req, res) => {
    const repos = db.prepare("SELECT * FROM github_repos LIMIT 100").all().map((r: any) => ({
      ...r,
      tags: JSON.parse(r.tags)
    }));
    res.json(repos);
  });

  // HuggingFace API
  app.get("/api/huggingface/models", (req, res) => {
    const models = db.prepare("SELECT * FROM huggingface_models LIMIT 100").all().map((m: any) => ({
      ...m,
      tags: JSON.parse(m.tags)
    }));
    res.json(models);
  });

  // App Store API
  app.get("/api/appstore/featured", (req, res) => {
    const app = db.prepare("SELECT * FROM app_store_apps WHERE is_featured = 1 LIMIT 1").get() as any;
    if (app) {
      res.json({ ...app, screenshots: JSON.parse(app.screenshots) });
    } else {
      res.status(404).json({ error: "Featured app not found" });
    }
  });

  app.get("/api/appstore/topcharts", (req, res) => {
    const apps = db.prepare("SELECT * FROM app_store_apps WHERE is_top_chart = 1 ORDER BY rank ASC").all().map((a: any) => ({
      ...a,
      screenshots: JSON.parse(a.screenshots)
    }));
    res.json(apps);
  });

  app.get("/api/appstore/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM app_store_categories").all() as any[];
    const result = categories.map(cat => {
      const apps = db.prepare(`
        SELECT a.* 
        FROM app_store_apps a
        JOIN app_store_category_apps ca ON a.id = ca.app_id
        WHERE ca.category_id = ?
      `).all(cat.id).map((a: any) => ({
        ...a,
        screenshots: JSON.parse(a.screenshots)
      }));
      return { ...cat, apps };
    });
    res.json(result);
  });

  app.get("/api/appstore/apps/:id", (req, res) => {
    const { id } = req.params;
    const app = db.prepare("SELECT * FROM app_store_apps WHERE id = ?").get(id) as any;
    if (app) {
      res.json({ ...app, screenshots: JSON.parse(app.screenshots) });
    } else {
      res.status(404).json({ error: "App not found" });
    }
  });

  // Claws API
  app.get("/api/claws", (req, res) => {
    const claws = db.prepare("SELECT * FROM claws").all();
    res.json(claws);
  });

  app.get("/api/claws/:id", (req, res) => {
    const { id } = req.params;
    const claw = db.prepare("SELECT * FROM claws WHERE id = ?").get(id);
    if (claw) {
      res.json(claw);
    } else {
      res.status(404).json({ error: "Claw not found" });
    }
  });

  app.get("/api/claws/:id/detail", (req, res) => {
    const { id } = req.params;
    const claw = db.prepare(`
      SELECT c.*, d.kernel, d.diskUsage, d.macAddress, d.connectedDevices, d.activeTasks 
      FROM claws c 
      JOIN claw_details d ON c.id = d.id 
      WHERE c.id = ?
    `).get(id);
    if (claw) {
      res.json(claw);
    } else {
      res.status(404).json({ error: "Claw detail not found" });
    }
  });

  // Channels API
  app.get("/api/channels", (req, res) => {
    const channels = db.prepare("SELECT * FROM channels").all() as any[];
    const result = channels.map(channel => {
      const fields = db.prepare("SELECT * FROM channel_fields WHERE channel_id = ?").all(channel.id);
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
    db.prepare("UPDATE channels SET enabled = ?, status = ? WHERE id = ?").run(enabled ? 1 : 0, enabled ? 'connected' : 'disconnected', id);
    res.json({ success: true });
  });

  app.put("/api/channels/:id/config", (req, res) => {
    const { id } = req.params;
    const configData = req.body;
    
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(configData)) {
        db.prepare("UPDATE channel_fields SET value = ? WHERE channel_id = ? AND key = ?").run(value, id, key);
      }
      db.prepare("UPDATE channels SET status = 'connected', enabled = 1 WHERE id = ?").run(id);
    });
    transaction();
    
    res.json({ success: true });
  });

  app.delete("/api/channels/:id/config", (req, res) => {
    const { id } = req.params;
    
    const transaction = db.transaction(() => {
      db.prepare("UPDATE channel_fields SET value = NULL WHERE channel_id = ?").run(id);
      db.prepare("UPDATE channels SET status = 'not_configured', enabled = 0 WHERE id = ?").run(id);
    });
    transaction();
    
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
