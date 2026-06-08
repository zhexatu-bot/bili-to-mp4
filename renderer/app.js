(() => {
  const $ = id => document.getElementById(id);
  const cacheDir = $('cacheDir');
  const outputDir = $('outputDir');
  const btnScan = $('btnScan');
  const videoSection = $('videoSection');
  const videoCount = $('videoCount');
  const videoList = $('videoList');
  const checkAll = $('checkAll');
  const btnConvert = $('btnConvert');
  const btnOpenDir = $('btnOpenDir');
  const progressSection = $('progressSection');
  const progressBar = $('progressBar');
  const progressText = $('progressText');
  const progressStats = $('progressStats');

  let videos = [];

  // ========== 扫描 ==========
  btnScan.onclick = async () => {
    btnScan.disabled = true;
    btnScan.textContent = '扫描中...';
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheDir: cacheDir.value }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }

      videos = data.videos;
      videoCount.textContent = `找到 ${videos.length} 个视频`;
      renderVideoList();
      videoSection.style.display = videos.length > 0 ? 'block' : 'none';
      progressSection.style.display = 'none';
    } catch (err) {
      showToast('扫描失败: ' + err.message);
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = '🔍 扫描视频';
    }
  };

  function renderVideoList() {
    checkAll.checked = true;
    videoList.innerHTML = videos.map((v, i) => `
      <div class="video-item">
        <input type="checkbox" class="video-check" data-idx="${i}" checked>
        <span class="video-title" title="${esc(v.title)}">${esc(v.title)}</span>
        <span class="video-type">${v.type}</span>
      </div>
    `).join('');
  }

  // 全选/取消
  checkAll.onchange = () => {
    videoList.querySelectorAll('.video-check').forEach(cb => { cb.checked = checkAll.checked; });
  };

  // ========== 转换 ==========
  btnConvert.onclick = async () => {
    const selected = [];
    videoList.querySelectorAll('.video-check').forEach(cb => {
      if (cb.checked) selected.push(videos[Number(cb.dataset.idx)]);
    });
    if (!selected.length) { showToast('请至少选择一个视频'); return; }

    btnConvert.disabled = true;
    btnConvert.textContent = '转换中...';
    progressSection.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.textContent = '';
    progressText.textContent = '准备中...';
    progressStats.innerHTML = '';

    // 建立 SSE 连接接收进度
    const evtSource = new EventSource('/api/progress');
    evtSource.onmessage = (e) => {
      const p = JSON.parse(e.data);
      updateProgress(p);
      if (p.status === 'done') {
        evtSource.close();
        btnConvert.disabled = false;
        btnConvert.textContent = '▶ 转换选中';
        showToast('转换完成！');
      }
    };
    evtSource.onerror = () => { evtSource.close(); };

    // 发起转换
    try {
      await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: selected, outputDir: outputDir.value }),
      });
    } catch (err) {
      showToast('转换请求失败: ' + err.message);
      btnConvert.disabled = false;
      btnConvert.textContent = '▶ 转换选中';
    }
  };

  function updateProgress(p) {
    const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressBar.textContent = pct + '%';
    progressText.textContent = p.status === 'done'
      ? '转换完成！'
      : `${p.current}/${p.total}  正在转换: ${p.title}...`;
    progressStats.innerHTML = `
      <span class="stat-success">✅ 成功: ${p.success}</span>
      <span class="stat-skip">⏭ 跳过: ${p.skip}</span>
      <span class="stat-fail">❌ 失败: ${p.fail}</span>
    `;
  }

  // ========== 打开目录 ==========
  btnOpenDir.onclick = async () => {
    try {
      await fetch('/api/open-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: outputDir.value }),
      });
    } catch {}
  };

  // ========== 工具 ==========
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
})();
