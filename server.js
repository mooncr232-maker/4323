const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { nanoid } = require('nanoid');
const {
  S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand
} = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '777';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

// ===== Cloudflare R2 config (S3-compatible) =====
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
// Public URL base for the bucket — either the free "r2.dev" dev URL or a custom domain.
// Example: https://pub-xxxxxxxx.r2.dev  (NO trailing slash)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
  console.warn('⚠️  R2 environment variables არასრულია — იხილეთ README.md, სექცია "Cloudflare R2 გამართვა"');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

const METADATA_KEY = 'data/videos.json';
const LOGO_PATH = path.join(__dirname, 'public', 'assets', 'logo.png');

// ===== R2 helpers =====
async function s3PutBuffer(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
}

async function s3GetBuffer(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function s3Delete(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

async function readVideos() {
  try {
    const buf = await s3GetBuffer(METADATA_KEY);
    return JSON.parse(buf.toString('utf-8'));
  } catch (err) {
    if (err.name === 'NoSuchKey') return [];
    throw err;
  }
}

async function writeVideos(videos) {
  await s3PutBuffer(METADATA_KEY, Buffer.from(JSON.stringify(videos, null, 2)), 'application/json');
}

function publicUrl(key) {
  return `${R2_PUBLIC_URL}/${key}`;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 3);
}

async function generateThumbnailBuffer(title) {
  const W = 800, H = 450;
  const lines = wrapText(title, 22);
  const lineHeight = 56;
  const startY = H - 40 - (lines.length - 1) * lineHeight;
  const textSvgLines = lines.map((line, i) =>
    `<text x="50%" y="${startY + i * lineHeight}" text-anchor="middle" class="title">${escapeXml(line)}</text>`
  ).join('');

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title {
          fill: #FFD400;
          font-size: 42px;
          font-weight: 800;
          font-family: Arial, Helvetica, sans-serif;
          paint-order: stroke;
          stroke: #000000;
          stroke-width: 5px;
          stroke-linejoin: round;
        }
      </style>
      ${textSvgLines}
    </svg>
  `;

  return sharp(LOGO_PATH)
    .resize(W, H, { fit: 'contain', background: '#0a0a0a' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ===== middleware =====
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 } // 30 days
}));

app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'not authorized' });
}

// multer keeps the upload in memory — it's forwarded straight to R2, never touches local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4' || file.originalname.toLowerCase().endsWith('.mp4')) {
      cb(null, true);
    } else {
      cb(new Error('მხოლოდ MP4 ფორმატის ვიდეოებია დაშვებული'));
    }
  }
});

// ================= AUTH ROUTES =================
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'პაროლი არასწორია' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ================= PUBLIC ROUTES =================
app.get('/api/videos', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    let videos = (await readVideos()).sort((a, b) => b.createdAt - a.createdAt);
    if (q) videos = videos.filter(v => v.title.toLowerCase().includes(q));
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = (await readVideos()).find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'ვიდეო ვერ მოიძებნა' });
    res.json(video);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// ================= ADMIN ROUTES =================
app.post('/api/admin/upload', requireAdmin, upload.single('video'), async (req, res) => {
  try {
    const title = (req.body.title || 'უსახელო ვიდეო').trim();
    if (!req.file) return res.status(400).json({ error: 'ვიდეო ფაილი არ არის მიბმული' });

    const id = nanoid(10);
    const videoKey = `videos/${id}.mp4`;
    const thumbKey = `thumbnails/${id}.jpg`;

    const thumbBuffer = await generateThumbnailBuffer(title);

    await s3PutBuffer(videoKey, req.file.buffer, 'video/mp4');
    await s3PutBuffer(thumbKey, thumbBuffer, 'image/jpeg');

    const videos = await readVideos();
    const video = {
      id,
      title,
      videoUrl: publicUrl(videoKey),
      thumbUrl: publicUrl(thumbKey),
      videoKey,
      thumbKey,
      createdAt: Date.now()
    };
    videos.push(video);
    await writeVideos(videos);
    res.json({ ok: true, video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ატვირთვისას მოხდა შეცდომა' });
  }
});

app.put('/api/admin/videos/:id', requireAdmin, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'სახელი ცარიელია' });

    const videos = await readVideos();
    const video = videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'ვიდეო ვერ მოიძებნა' });

    video.title = title.trim();
    const thumbBuffer = await generateThumbnailBuffer(video.title);
    await s3PutBuffer(video.thumbKey, thumbBuffer, 'image/jpeg');
    await writeVideos(videos);
    res.json({ ok: true, video });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'განახლებისას მოხდა შეცდომა' });
  }
});

app.delete('/api/admin/videos/:id', requireAdmin, async (req, res) => {
  try {
    const videos = await readVideos();
    const idx = videos.findIndex(v => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'ვიდეო ვერ მოიძებნა' });

    const [video] = videos.splice(idx, 1);
    await Promise.all([s3Delete(video.videoKey), s3Delete(video.thumbKey)]);
    await writeVideos(videos);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'წაშლისას მოხდა შეცდომა' });
  }
});

app.listen(PORT, () => {
  console.log(`სერვერი გაშვებულია პორტზე ${PORT}`);
});
