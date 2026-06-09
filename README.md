# B站缓存视频转 MP4 / Bilibili Cache to MP4

B站客户端缓存的视频是 .m4s 和 .blv 格式，只能在B站 App 里播放，投屏投不了，导出导不了，换个设备就没了。之前用 Python 代码跑通过一次，但每次要开命令行、还要单独下载 ffmpeg，太麻烦了。所以做了一个安装包版本，装完直接用。

Bilibili client caches videos in .m4s and .blv formats — only playable in the Bilibili app. Can't cast to TV, can't export, lose them when switching devices. I had a Python script that worked, but it required the command line and a separate ffmpeg download. So I packaged it into an installer that just works.

---

## 功能 / Features

- 自动扫描B站缓存目录，列出所有可转换视频 / Auto-scan Bilibili cache directory, list all convertible videos
- 支持批量转换，勾选要转的，一键搞定 / Batch conversion with checkboxes
- 支持三种缓存格式 / Supports 3 cache formats:
  - video.m4s + audio.m4s（新版分离音视频） / New format (separate audio/video)
  - 单个 .m4s 文件 / Single .m4s file
  - .blv 分段文件（老版格式） / .blv segments (legacy format)
- 已转换的自动跳过，不重复处理 / Auto-skip already converted files
- 实时进度条，显示成功/跳过/失败统计 / Real-time progress bar with stats
- 转完一键打开输出目录 / One-click open output directory

## 优势 / Why This Tool

**零依赖 / Zero Dependencies**: 不需要装 Python，不需要单独下载 ffmpeg，不需要配环境。安装包里全部内置了，97MB 的 ffmpeg 直接打包进去。双击安装，打开就能用。

No Python, no separate ffmpeg download, no environment setup. Everything bundled in the installer (including 97MB ffmpeg). Double-click to install and use.

**高质量输出 / High Quality Output**: 视频转 H.264，音频转 AAC 192kbps，分辨率帧率不变。转出来的 MP4 任何播放器都能播。

Video: H.264, Audio: AAC 192kbps. Resolution and frame rate preserved. Output MP4 plays in any player.

**100% 本地 / 100% Local**: 所有转换在自己电脑上完成，不上传任何东西，不需要联网。

All conversion happens on your machine. No upload, no internet needed.

## 怎么用 / How to Use

1. 下载安装包，双击安装 / Download installer, double-click to install
2. 打开软件 / Open the app
3. 填入B站缓存目录（在B站客户端 设置 - 下载设置 里能看到路径） / Enter Bilibili cache directory (Settings → Download Settings in Bilibili app)
4. 填入输出目录 / Enter output directory
5. 点扫描，列出所有视频 / Click scan to list all videos
6. 勾选要转的，点转换 / Select videos, click convert
7. 等进度条走完，去输出目录看结果 / Wait for progress to finish, check output directory

## B站缓存目录在哪 / Where is the Cache Directory

打开B站客户端，设置，下载设置，查看下载路径。

Open Bilibili app → Settings → Download Settings → check download path.

目录结构一般 / Directory structure:

```
download/
├── av号 或 bv号/
│   ├── entry.json
│   ├── video.m4s
│   └── audio.m4s
```

## 安装 / Installation

从 [Releases](../../releases) 下载安装包即可。

Download installer from [Releases](../../releases).

源码运行 / Run from source:

```bash
npm install
npm start
```

## 技术栈 / Tech Stack

- Electron 桌面框架 / Desktop framework
- Express 本地 API / Local API
- ffmpeg 音视频转码（内置） / Video transcoding (bundled)
- Node.js 后端逻辑 / Backend logic

## 联系方式 / Contact

- GitHub: [zhexatu-bot](https://github.com/zhexatu-bot)
- WeChat: matlabpython888
