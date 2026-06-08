const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'renderer')));

const PORT = 3456;

// ========== ffmpeg 路径 ==========
function getFfmpegPath() {
  if (process.env.NODE_ENV === 'production' || require('electron').app?.isPackaged) {
    return path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
  }
  return path.join(__dirname, 'ffmpeg', 'ffmpeg.exe');
}

// ========== 工具函数 ==========

function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'untitled';
}

function loadJson(jsonPath) {
  for (const enc of ['utf-8', 'utf-8-sig', 'gbk']) {
    try {
      const text = fs.readFileSync(jsonPath, enc);
      return JSON.parse(text);
    } catch { continue; }
  }
  return null;
}

function getTitleFromEntry(entryJsonPath) {
  const data = loadJson(entryJsonPath);
  if (!data) return safeFilename(path.basename(path.dirname(entryJsonPath)));

  const title = data.title || '';
  let part = '';
  if (data.page_data && typeof data.page_data === 'object') {
    part = data.page_data.part || '';
  }
  if (!part) part = data.part || '';

  let finalTitle = (title && part && part !== title) ? `${title} - ${part}` : (title || path.basename(path.dirname(entryJsonPath)));
  return safeFilename(finalTitle);
}

function findMediaFiles(videoRoot) {
  const m4sFiles = [];
  const blvFiles = [];

  function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      const ext = path.extname(f.name).toLowerCase();
      if (ext === '.m4s') m4sFiles.push(full);
      else if (ext === '.blv') blvFiles.push(full);
    }
  }
  walk(videoRoot);

  if (blvFiles.length > 0) {
    return { type: 'blv', blvFiles: blvFiles.sort() };
  }
  if (m4sFiles.length === 0) return null;

  let videoFile = null, audioFile = null;
  for (const f of m4sFiles) {
    const name = path.basename(f).toLowerCase();
    if (name.includes('video') && !videoFile) videoFile = f;
    else if (name.includes('audio') && !audioFile) audioFile = f;
  }

  if (!videoFile || !audioFile) {
    const sorted = m4sFiles.slice().sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
    if (!videoFile && sorted[0]) videoFile = sorted[0];
    if (!audioFile) {
      for (const f of sorted.reverse()) {
        if (f !== videoFile) { audioFile = f; break; }
      }
    }
  }

  if (videoFile && audioFile) return { type: 'm4s', videoFile, audioFile };
  if (m4sFiles.length === 1) return { type: 'single', singleFile: m4sFiles[0] };
  return null;
}

// ========== 扫描 API ==========

app.post('/api/scan', (req, res) => {
  const { cacheDir } = req.body;
  if (!cacheDir || !fs.existsSync(cacheDir)) {
    return res.status(400).json({ error: '缓存目录不存在' });
  }

  const videos = [];
  function findEntries(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { findEntries(full); continue; }
      if (f.name === 'entry.json') {
        const title = getTitleFromEntry(full);
        const mediaInfo = findMediaFiles(path.dirname(full));
        if (mediaInfo) {
          videos.push({ title, type: mediaInfo.type, entryPath: full, mediaInfo });
        }
      }
    }
  }
  findEntries(cacheDir);
  res.json({ videos, total: videos.length });
});

// ========== 转换 API ==========

let converting = false;
let progress = { current: 0, total: 0, title: '', status: 'idle', success: 0, skip: 0, fail: 0 };

// SSE 推送进度
const sseClients = [];
app.get('/api/progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: ${JSON.stringify(progress)}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

function broadcastProgress() {
  const msg = `data: ${JSON.stringify(progress)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
}

function runFfmpeg(args) {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();
    const proc = spawn(ffmpegPath, ['-y', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stderr }));
    proc.on('error', (err) => resolve({ code: -1, stderr: err.message }));
  });
}

async function convertVideo(video, outputDir) {
  const outputName = `${video.title}.mp4`;
  const outputFile = path.join(outputDir, outputName);

  if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
    return { status: 'skip', output: outputFile };
  }

  const args = [];
  if (video.type === 'm4s') {
    args.push(
      '-i', video.mediaInfo.videoFile,
      '-i', video.mediaInfo.audioFile,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outputFile
    );
  } else if (video.type === 'single') {
    args.push(
      '-i', video.mediaInfo.singleFile,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outputFile
    );
  } else if (video.type === 'blv') {
    const tempTxt = path.join(outputDir, `__concat_${Date.now()}.txt`);
    const content = video.mediaInfo.blvFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(tempTxt, content, 'utf-8');
    args.push(
      '-f', 'concat', '-safe', '0', '-i', tempTxt,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outputFile
    );
    // 清理临时文件在转码后
    setTimeout(() => { try { fs.unlinkSync(tempTxt); } catch {} }, 5000);
  }

  const result = await runFfmpeg(args);
  if (result.code === 0 && fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
    return { status: 'success', output: outputFile };
  }
  // 清理失败文件
  try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch {}
  return { status: 'fail', error: result.stderr?.slice(-200) || 'unknown error' };
}

app.post('/api/convert', async (req, res) => {
  if (converting) return res.status(409).json({ error: '正在转换中' });

  const { videos, outputDir } = req.body;
  if (!videos || !videos.length) return res.status(400).json({ error: '没有视频' });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  converting = true;
  progress = { current: 0, total: videos.length, title: '', status: 'converting', success: 0, skip: 0, fail: 0 };
  broadcastProgress();
  res.json({ ok: true });

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    progress.current = i + 1;
    progress.title = video.title;
    broadcastProgress();

    try {
      const result = await convertVideo(video, outputDir);
      progress[result.status]++;
    } catch (err) {
      progress.fail++;
    }
    broadcastProgress();
  }

  progress.status = 'done';
  broadcastProgress();
  converting = false;
});

// ========== 打开目录 ==========

app.post('/api/open-dir', (req, res) => {
  const { dir } = req.body;
  if (dir && fs.existsSync(dir)) {
    require('child_process').exec(`explorer "${dir}"`);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: '目录不存在' });
  }
});

// ========== 启动 ==========

app.listen(PORT, () => {
  console.log(`B站缓存转换服务: http://localhost:${PORT}`);
});

module.exports = app;
