/**
 * MBIRE TV ZIMBABWE — YouTube API Integration
 * Fetches uploads and live stream state from channel @MBIRETVNews in real-time
 */

const YOUTUBE_CONFIG = {
  apiKey:        'AIzaSyBc_tdiRhnWMS3fzOFkBuiGIGBk2lOJl3k',
  channelId:     'UC5NvzBZXI-tvbpR94sZlB3A',
  channelHandle: '@MBIRETVNews',
  maxResults:    15
};

const YOUTUBE_FALLBACK = {
  uploadsPlaylistId: 'UU5NvzBZXI-tvbpR94sZlB3A',
  channelUrl:        'https://www.youtube.com/@MBIRETVNews'
};

function isYouTubeApiKeyConfigured() {
  return YOUTUBE_CONFIG.apiKey && !YOUTUBE_CONFIG.apiKey.startsWith('YOUR_');
}

// ─── Format Time Elapsed ──────────────────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
  return date.toLocaleDateString();
}

// ─── Guess Video Categories ──────────────────────────────────
function guessCategory(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  const categoryKeywords = {
    politics:  ['politics', 'election', 'government', 'minister', 'parliament', 'policy', 'president', 'zimbabwe'],
    business:  ['business', 'economy', 'trade', 'market', 'investment', 'mining', 'finance', 'dollars'],
    sports:    ['sports', 'football', 'cricket', 'warriors', 'rugby', 'athletics', 'soccer'],
    culture:   ['culture', 'heritage', 'arts', 'music', 'tradition', 'festival', 'dance']
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return 'general';
}

// ─── Render Video Cards (Grid) ────────────────────────────────
function renderVideoCard(video) {
  const videoId = video.snippet?.resourceId?.videoId || video.id?.videoId || video.id;
  if (!videoId) return null;

  const snippet = video.snippet;
  const stats = video.statistics || {};
  const viewCount = Number(stats.viewCount || 0).toLocaleString();
  const likeCount = Number(stats.likeCount || 0).toLocaleString();
  const title = snippet.title || 'Untitled Video';
  const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.high?.url || 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
  const dateStr = snippet.publishedAt ? timeAgo(snippet.publishedAt) : '';
  const cat = guessCategory(title, snippet.description || '');

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cursor = 'pointer';
  card.setAttribute('data-video-id', videoId);
  card.setAttribute('data-cat', cat);

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${thumb}" alt="${title}" loading="lazy">
      <div class="card-play">
        <div class="play-icon"><i class="fas fa-play"></i></div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-meta" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">
        <span><i class="far fa-clock"></i> ${dateStr}</span>
        <div style="display:flex; gap:8px;">
          <span><i class="far fa-eye"></i> ${viewCount}</span>
          <span><i class="far fa-thumbs-up"></i> ${likeCount}</span>
        </div>
      </div>
      <h3 class="card-title">${title}</h3>
    </div>
  `;

  card.addEventListener('click', () => {
    openVideoModal(videoId, title);
  });

  return card;
}

// ─── Render Video Row (List Style) ───────────────────────────
function renderVideoRow(video, isNewest = false) {
  const videoId = video.snippet?.resourceId?.videoId || video.id?.videoId || video.id;
  if (!videoId) return null;

  const snippet = video.snippet;
  const stats = video.statistics || {};
  const viewCount = Number(stats.viewCount || 0).toLocaleString();
  const likeCount = Number(stats.likeCount || 0).toLocaleString();
  const title = snippet.title || 'Untitled Video';
  const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.high?.url || 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
  const dateStr = snippet.publishedAt ? timeAgo(snippet.publishedAt) : '';

  const row = document.createElement('div');
  row.className = 'video-row';
  row.innerHTML = `
    <div class="video-row-thumb">
      <img src="${thumb}" alt="${title}" loading="lazy">
      <div class="video-row-play"><i class="fas fa-play"></i></div>
    </div>
    <div class="video-row-body">
      <div>
        <h3 class="video-row-title">${title}</h3>
        <p style="font-size:0.82rem; color:var(--text-muted); display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px;">
          ${snippet.description || 'Watch the full video coverage directly from Mbire TV Zimbabwe.'}
        </p>
      </div>
      <div class="video-row-meta" style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${isNewest ? `<span class="video-new-badge"><i class="fas fa-fire"></i> NEWEST</span>` : ''}
          <span><i class="far fa-clock"></i> ${dateStr}</span>
        </div>
        <div style="display:flex; gap:12px; font-size:0.78rem; color:var(--text-muted);">
          <span><i class="far fa-eye"></i> ${viewCount} views</span>
          <span><i class="far fa-thumbs-up"></i> ${likeCount} likes</span>
        </div>
      </div>
    </div>
  `;

  row.addEventListener('click', () => {
    openVideoModal(videoId, title);
  });

  return row;
}

// ─── Open Video Player Modal ─────────────────────────────────
function openVideoModal(videoId, title) {
  let modal = document.getElementById('videoModal');
  let iframe = document.getElementById('modalIframe');

  if (!modal || !iframe) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    return;
  }

  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1&playsinline=1`;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const titleEl = document.getElementById('modalVideoTitle');
  if (titleEl) titleEl.textContent = title || 'Video Comments';

  loadModalComments(videoId);

  // Track for mini player (will show if user navigates away)
  if (window.MbireMiniPlayer) {
    window.MbireMiniPlayer.show(videoId, title, false);
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'MBIRE TV ZIMBABWE',
      artist: 'MBIRE TV ZIMBABWE',
      album: 'YouTube Live & On-Demand',
      artwork: [
        { src: 'https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg', sizes: '320x180', type: 'image/jpeg' },
        { src: 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }
      ]
    });
  }
}

// ─── Modal Video Comments System ─────────────────────────────
let currentModalVideoId = '';
let modalCommentsList = [];

async function loadModalComments(videoId) {
  currentModalVideoId = videoId;
  const grid = document.getElementById('modalCommentsListGrid');
  const userBadge = document.getElementById('modalCommentUserBadge');
  const guestGroup = document.getElementById('modalGuestNameGroup');
  const guestNameInput = document.getElementById('modalGuestNameInput');
  if (!grid) return;

  const localUser = JSON.parse(localStorage.getItem('mbire_user') || 'null');
  if (localUser) {
    // Logged in — hide name input, show member badge
    if (guestGroup) guestGroup.style.display = 'none';
    if (userBadge) {
      userBadge.textContent = `Commenting as ${localUser.name} (${localUser.role === 'superadmin' ? 'Admin' : 'Member'})`;
    }
  } else {
    // Guest — restore saved name and wire live badge update
    const savedName = localStorage.getItem('mbire_guest_name') || '';
    if (guestNameInput && savedName) {
      guestNameInput.value = savedName;
    }
    if (userBadge) {
      userBadge.textContent = savedName ? `Commenting as ${savedName}` : 'Enter your name above';
    }
  }

  try {
    grid.innerHTML = '<div style="text-align:center;padding:12px;"><i class="fas fa-spinner fa-spin" style="color:var(--red);"></i></div>';
    modalCommentsList = await fsGetCommentsByArticle(videoId);
    
    if (modalCommentsList.length === 0) {
      grid.innerHTML = '<p class="text-muted" style="text-align:center;padding:12px 0;font-size:0.85rem;">No comments on this video yet. Be the first to comment!</p>';
      return;
    }

    grid.innerHTML = '';
    modalCommentsList.forEach(cmt => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.style.cssText = 'display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;align-items:flex-start;';
      const initials = (cmt.authorName || 'G').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      item.innerHTML = `
        <div class="comment-avatar" style="width:30px;height:30px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;">${initials}</div>
        <div class="comment-body" style="flex:1;">
          <div class="comment-meta" style="display:flex;gap:8px;font-size:0.72rem;color:var(--text-muted);margin-bottom:2px;">
            <span class="comment-user" style="font-weight:600;color:var(--text);">${cmt.authorName}</span>
            <span class="comment-date">${timeAgo(cmt.date)}</span>
          </div>
          <p class="comment-text" style="font-size:0.82rem;color:var(--text-dim);margin:0;line-height:1.4;">${cmt.text}</p>
        </div>
      `;
      grid.appendChild(item);
    });
  } catch (err) {
    console.warn('Error loading modal comments:', err);
  }
}

async function postNewModalComment() {
  const input = document.getElementById('modalCommentInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) { alert('Please write a comment first.'); return; }

  const localUser = JSON.parse(localStorage.getItem('mbire_user') || 'null');
  let authorName;

  if (localUser) {
    authorName = localUser.name;
  } else {
    // Guest must provide a name
    const nameInput = document.getElementById('modalGuestNameInput');
    const typedName = nameInput ? nameInput.value.trim() : '';
    if (!typedName) {
      nameInput && nameInput.focus();
      alert('Please enter your name before commenting.');
      return;
    }
    authorName = typedName;
    try { localStorage.setItem('mbire_guest_name', typedName); } catch(e) {}
  }

  const newCmt = {
    id: 'cmt_' + Date.now(),
    articleId: currentModalVideoId,
    authorName: authorName,
    text: val,
    date: new Date().toISOString()
  };

  try {
    await fsSaveComment(newCmt);
    input.value = '';
    await loadModalComments(currentModalVideoId);
  } catch (e) {
    console.error('Error posting modal comment:', e);
  }
}

window.postNewModalComment = postNewModalComment;

// ─── Close Video Modal ──────────────────────────────────────
function closeVideoModal() {
  const modal = document.getElementById('videoModal');
  const iframe = document.getElementById('modalIframe');
  if (modal) modal.classList.remove('open');
  if (iframe) iframe.src = '';
  document.body.style.overflow = '';
  // User explicitly stopped the video — clear mini player state
  if (window.MbireMiniPlayer) window.MbireMiniPlayer.close();
}

// ─── Fetch Uploads Feed ──────────────────────────────────────
let isLoadingVideos = false;
let youtubeNextPageToken = '';

async function fetchYouTubeVideos(targetGridId = 'youtubeGrid', maxResults = YOUTUBE_CONFIG.maxResults, loadMore = false) {
  if (isLoadingVideos) return;
  const grid = document.getElementById(targetGridId);
  if (!grid) return;

  const loader = document.getElementById('videosLoader');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadMoreSpinner = document.getElementById('loadMoreSpinner');

  if (!isYouTubeApiKeyConfigured()) {
    showVideosFallback(grid);
    if (loader) loader.style.display = 'none';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  try {
    isLoadingVideos = true;
    if (loadMore) {
      if (loadMoreSpinner) loadMoreSpinner.style.display = 'inline-block';
      if (loadMoreBtn) loadMoreBtn.disabled = true;
    } else {
      if (loader) loader.style.display = 'flex';
    }

    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_FALLBACK.uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_CONFIG.apiKey}`;
    if (loadMore && youtubeNextPageToken) {
      url += `&pageToken=${youtubeNextPageToken}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    youtubeNextPageToken = data.nextPageToken || '';

    if (loader) loader.style.display = 'none';
    if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
    
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      if (youtubeNextPageToken) {
        loadMoreBtn.style.display = 'inline-flex';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }

    if (!loadMore) {
      grid.innerHTML = '';
    }

    if ((!data.items || data.items.length === 0) && !loadMore) {
      grid.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:40px;">No YouTube uploads found.</p>';
      return;
    }

    const items = data.items || [];

    // Fetch video statistics (views & likes)
    const videoIds = items.map(item => item.snippet?.resourceId?.videoId || item.id?.videoId || item.id).filter(Boolean);
    if (videoIds.length) {
      try {
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${YOUTUBE_CONFIG.apiKey}`;
        const statsRes = await fetch(statsUrl);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const statsMap = {};
          (statsData.items || []).forEach(v => {
            statsMap[v.id] = v.statistics;
          });
          items.forEach(item => {
            const vId = item.snippet?.resourceId?.videoId || item.id?.videoId || item.id;
            if (statsMap[vId]) {
              item.statistics = statsMap[vId];
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch video statistics:', err);
      }
    }

    // Check if we are on the Home page and want to isolate the newest video as breaking
    const homeBreakingContainer = document.getElementById('breakingVideoContainer');
    if (homeBreakingContainer && targetGridId === 'indexVideosGrid') {
      const newestVid = items[0];
      const newestId = newestVid.snippet?.resourceId?.videoId || newestVid.id?.videoId || newestVid.id;
      const snippet = newestVid.snippet;
      const thumb = snippet.thumbnails?.high?.url || 'https://img.youtube.com/vi/' + newestId + '/maxresdefault.jpg';
      
      homeBreakingContainer.innerHTML = `
        <div class="video-row" style="background:#FFF8F8; border-color:var(--red); padding:10px; margin-bottom:12px;">
          <div class="video-row-thumb" style="width:280px; min-width:280px;">
            <img src="${thumb}" alt="${snippet.title}">
            <span class="video-row-badge" style="background:var(--red); color:#fff;"><i class="fas fa-bullhorn"></i> BREAKING VIDEO</span>
            <div class="video-row-play" style="opacity:1; background:var(--red);"><i class="fas fa-play"></i></div>
          </div>
          <div class="video-row-body" style="padding-left:16px;">
            <div>
              <span class="badge badge-red" style="margin-bottom:8px;"><i class="fas fa-exclamation-circle"></i> NEWEST YOUTUBE BROADCAST</span>
              <h3 class="video-row-title" style="font-size:1.25rem; font-weight:700; color:var(--text);">${snippet.title}</h3>
              <p style="font-size:0.85rem; color:var(--text-dim); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-top:8px;">
                ${snippet.description || 'Watch the latest broadcast video directly from our YouTube channel.'}
              </p>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
              <span><i class="far fa-clock"></i> Published ${timeAgo(snippet.publishedAt)}</span>
            </div>
          </div>
        </div>
      `;
      homeBreakingContainer.querySelector('.video-row').onclick = () => {
        openVideoModal(newestId, snippet.title);
      };

      // Populate indexVideosGrid with remaining items (index 1 to 4)
      const remainingItems = items.slice(1, 4);
      remainingItems.forEach(video => {
        const card = renderVideoCard(video);
        if (card) grid.appendChild(card);
      });
    } else {
      // Videos page: Render as beautiful vertical list rows
      if (targetGridId === 'youtubeGrid') {
        let listContainer = grid.querySelector('.video-list');
        if (!listContainer) {
          listContainer = document.createElement('div');
          listContainer.className = 'video-list';
          grid.appendChild(listContainer);
        }
        
        items.forEach((video, index) => {
          // Display the newest fire pill only on the absolute first item of page 1
          const isNewest = !loadMore && (index === 0);
          const row = renderVideoRow(video, isNewest);
          if (row) listContainer.appendChild(row);
        });
      } else {
        // Grid fallback
        items.forEach(video => {
          const card = renderVideoCard(video);
          if (card) grid.appendChild(card);
        });
      }
    }

  } catch (err) {
    console.error('YouTube Fetch Error:', err);
    if (!loadMore) {
      showVideosFallback(grid);
    }
    if (loader) loader.style.display = 'none';
    if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
  } finally {
    isLoadingVideos = false;
  }
}

// ─── Live Auto-Poll Interval ──────────────────────────────────
let _livePollingInterval = null;

// ─── Manual Refresh (no countdown reset needed) ──────────────
function manualRefreshLive() {
  checkChannelLiveState();
}

// ─── Start Polling (No-op since autocheck is removed) ──────────
function startLivePolling() {
  // Auto-polling disabled as per request
}

// ─── Inject or remove live banner on homepage ─────────────────
function updateHomeLiveBanner(isLive, videoId, title) {
  const container = document.getElementById('homeLiveBanner');
  if (!container) return;

  if (isLive && videoId) {
    container.style.display = 'block';
    container.innerHTML = `
      <div style="background:linear-gradient(135deg,#c00 0%,#ff3333 100%);border-radius:var(--radius-lg);padding:20px 24px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;box-shadow:0 4px 20px rgba(200,0,0,0.25);margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <span style="width:12px;height:12px;border-radius:50%;background:#fff;display:inline-block;animation:liveDotPulse 1s ease-in-out infinite;"></span>
          <span style="font-family:var(--font-title);font-size:0.9rem;font-weight:800;color:#fff;letter-spacing:2px;">LIVE NOW</span>
        </div>
        <div style="flex:1;min-width:200px;">
          <p style="color:#fff;font-weight:600;margin:0;font-size:0.95rem;">${title}</p>
          <p style="color:rgba(255,255,255,0.8);font-size:0.8rem;margin:2px 0 0 0;">MBIRE TV ZIMBABWE is broadcasting live on YouTube</p>
        </div>
        <a href="live.html" style="background:#fff;color:#c00;font-family:var(--font-title);font-weight:700;font-size:0.82rem;padding:8px 20px;border-radius:8px;text-decoration:none;letter-spacing:1px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;">
          <i class="fas fa-play-circle"></i> Watch Live
        </a>
      </div>
    `;
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

// ─── Fetch and show most recent past live / recent broadcast ──
async function loadRecentLiveReplay() {
  const panel   = document.getElementById('recentLivePanel');
  const player  = document.getElementById('recentLivePlayer');
  const titleEl = document.getElementById('recentLiveTitle');
  const metaEl  = document.getElementById('recentLiveMeta');
  const badge   = document.getElementById('recentLiveBadgeLabel');
  if (!panel || !player) return;

  // Helper: display the found video in the panel
  const showVideo = (id, title, dateStr, label) => {
    if (titleEl) titleEl.textContent = title;
    if (badge)   badge.textContent = label || 'Most Recent Live';
    if (metaEl)  metaEl.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <i class="fas fa-calendar-alt" style="color:var(--red);"></i>
        Broadcast on: <strong>${dateStr}</strong>
      </span>
      &nbsp;·&nbsp;
      <a href="https://www.youtube.com/watch?v=${id}" target="_blank"
         style="color:var(--red);font-weight:600;text-decoration:none;">
        <i class="fab fa-youtube"></i> Watch on YouTube
      </a>
    `;
    const targetSrc = `https://www.youtube.com/embed/${id}?rel=0`;
    // Only update iframe src if it is not already playing this video to avoid disrupting the user
    if (!player.src || !player.src.includes(id)) {
      player.src = targetSrc;
    }
    panel.style.display = 'block';
  };

  const fmtDate = (raw) => raw
    ? new Date(raw).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : 'Unknown date';

  // ── Step 1: Try eventType=completed (formally scheduled live events) ──
  try {
    const url1 = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CONFIG.channelId}&type=video&eventType=completed&order=date&maxResults=1&key=${YOUTUBE_CONFIG.apiKey}`;
    const res1 = await fetch(url1);
    if (res1.ok) {
      const data1 = await res1.json();
      if (data1.items && data1.items.length > 0) {
        const v = data1.items[0];
        showVideo(v.id.videoId, v.snippet.title, fmtDate(v.snippet.publishedAt), '🔴 Most Recent Live Broadcast');
        return;
      }
    }
  } catch (e1) { console.warn('Step 1 (completed) failed:', e1); }

  // ── Step 2: Search channel videos with "live" keyword ──────────────────
  try {
    const url2 = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CONFIG.channelId}&type=video&q=live&order=date&maxResults=5&key=${YOUTUBE_CONFIG.apiKey}`;
    const res2 = await fetch(url2);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.items && data2.items.length > 0) {
        const v = data2.items[0];
        showVideo(v.id.videoId, v.snippet.title, fmtDate(v.snippet.publishedAt), '📺 Recent Live Session');
        return;
      }
    }
  } catch (e2) { console.warn('Step 2 (keyword search) failed:', e2); }

  // ── Step 3: Fall back to most recent upload from the uploads playlist ──
  try {
    const url3 = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_FALLBACK.uploadsPlaylistId}&maxResults=1&key=${YOUTUBE_CONFIG.apiKey}`;
    const res3 = await fetch(url3);
    if (res3.ok) {
      const data3 = await res3.json();
      if (data3.items && data3.items.length > 0) {
        const v   = data3.items[0];
        const id  = v.snippet.resourceId?.videoId || v.snippet.resourceId;
        const t   = v.snippet.title;
        const dt  = fmtDate(v.snippet.publishedAt);
        showVideo(id, t, dt, '📡 Most Recent Broadcast');
        return;
      }
    }
  } catch (e3) { console.warn('Step 3 (playlist fallback) failed:', e3); }

  // All steps failed — hide panel
  panel.style.display = 'none';
}

// ─── Check Channel Live State ─────────────────────────────────
async function checkChannelLiveState() {
  const livePlayer    = document.getElementById('livePlayer');
  const offlineNotice = document.getElementById('liveOfflineNotice');
  const liveIndicator = document.getElementById('liveIndicator');
  const liveStatusText= document.getElementById('liveStatusText');

  // ── OFFLINE display helper ──────────────────────────────────
  const showOffline = (msg) => {
    const livePanel = document.querySelector('.live-panel');
    if (livePanel) livePanel.style.display = 'none';

    if (livePlayer) livePlayer.style.display = 'none';
    if (offlineNotice) {
      offlineNotice.style.display = 'flex';
      offlineNotice.innerHTML = `
        <div style="text-align:center;padding:32px 24px;max-width:480px;">
          <i class="fab fa-youtube" style="font-size:3rem;color:var(--text-muted);margin-bottom:16px;display:block;"></i>
          <p style="font-family:var(--font-title);font-size:1.1rem;text-transform:uppercase;letter-spacing:1px;color:var(--text);margin-bottom:8px;">Not Broadcasting</p>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px;">${msg}</p>
          <a href="${YOUTUBE_FALLBACK.channelUrl}" target="_blank" class="btn btn-primary btn-sm" style="display:inline-flex;gap:8px;">
            <i class="fab fa-youtube"></i> Visit YouTube Channel
          </a>
        </div>
      `;
    }
    if (liveIndicator) {
      liveIndicator.className = 'live-badge';
      const span = liveIndicator.querySelector('span:last-child');
      if (span) { span.textContent = 'OFFLINE'; span.style.color = 'var(--text-muted)'; }
      const dot = liveIndicator.querySelector('.live-dot');
      if (dot) dot.style.display = 'none';
    }
    if (liveStatusText) liveStatusText.textContent = 'Currently Offline';
    updateHomeLiveBanner(false);
    // Load the most recent past live for replay
    loadRecentLiveReplay();
  };

  if (!isYouTubeApiKeyConfigured()) {
    showOffline('YouTube API key configuration missing. Visit our channel directly to watch live.');
    return;
  }

  try {
    // ── 1. Check if LIVE RIGHT NOW ──────────────────────────────
    const liveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CONFIG.channelId}&eventType=live&type=video&key=${YOUTUBE_CONFIG.apiKey}`;
    const liveRes = await fetch(liveUrl);
    if (!liveRes.ok) throw new Error('Live check API failure');
    const liveData = await liveRes.json();

    if (liveData.items && liveData.items.length > 0) {
      // ── STATE: LIVE NOW ───────────────────────────────────────
      // Stop polling to prevent disrupting live playback!
      if (_livePollingInterval) {
        clearInterval(_livePollingInterval);
        _livePollingInterval = null;
      }
      const countdownEl = document.getElementById('refreshCountdown');
      if (countdownEl) {
        countdownEl.textContent = 'Auto-check stopped (Live Active)';
      }

      const liveVideo = liveData.items[0];
      const videoId   = liveVideo.id.videoId;
      const title     = liveVideo.snippet.title;

      const livePanel = document.querySelector('.live-panel');
      if (livePanel) livePanel.style.display = 'block';

      if (livePlayer) {
        livePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`;
        livePlayer.style.display = 'block';
      }
      if (offlineNotice) offlineNotice.style.display = 'none';

      if (liveIndicator) {
        liveIndicator.className = 'live-badge is-live';
        const span = liveIndicator.querySelector('span:last-child');
        if (span) { span.textContent = '🔴 LIVE NOW'; span.style.color = 'var(--red)'; }
        const dot = liveIndicator.querySelector('.live-dot');
        if (dot) dot.style.display = 'block';
      }
      if (liveStatusText) liveStatusText.textContent = `Streaming: ${title}`;

      // Update homepage live banner
      updateHomeLiveBanner(true, videoId, title);

      // Track for mini player — if user navigates away from live.html, video continues
      if (window.MbireMiniPlayer) {
        window.MbireMiniPlayer.show(videoId, title, true);
      }

      // Load comments for the active live video
      if (window.loadLiveComments) {
        window.loadLiveComments(videoId);
      }

      // Hide recent live panel while live is active
      const recentPanel = document.getElementById('recentLivePanel');
      if (recentPanel) recentPanel.style.display = 'none';
      return;
    }

    // ── 2. No live stream — check UPCOMING ──────────────────────
    const upcomingUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CONFIG.channelId}&eventType=upcoming&type=video&key=${YOUTUBE_CONFIG.apiKey}`;
    const upcomingRes = await fetch(upcomingUrl);
    if (upcomingRes.ok) {
      const upcomingData = await upcomingRes.json();
      if (upcomingData.items && upcomingData.items.length > 0) {
        // ── STATE: UPCOMING STREAM ──────────────────────────────
        const nextLive  = upcomingData.items[0];
        const nextId    = nextLive.id.videoId;
        const nextTitle = nextLive.snippet.title;
        
        // Fetch actual video details to get scheduledStartTime
        let actualStartTime = null;
        try {
          const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${nextId}&key=${YOUTUBE_CONFIG.apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            if (detailsData.items && detailsData.items.length > 0) {
              const streamDetails = detailsData.items[0].liveStreamingDetails;
              if (streamDetails && streamDetails.scheduledStartTime) {
                actualStartTime = streamDetails.scheduledStartTime;
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch detailed stream start time:', e);
        }

        const rawTime = actualStartTime || nextLive.snippet.publishedAt;
        const scheduledDate = rawTime ? new Date(rawTime) : null;
        const now = new Date();

        if (scheduledDate) {
          // If the scheduled start time is in the past by more than 2 hours (stale or cancelled)
          const gracePeriod = 2 * 60 * 60 * 1000; // 2 hours
          if (scheduledDate.getTime() + gracePeriod < now.getTime()) {
            showOffline('MBIRE TV ZIMBABWE is not currently broadcasting on YouTube. Check back soon or browse our recent broadcast below.');
            return;
          }
        }

        const timeStr = scheduledDate ? scheduledDate.toLocaleString() : 'soon';

        // Load comments for the upcoming live premiere
        if (window.loadLiveComments) {
          window.loadLiveComments(nextId);
        }

        const livePanel = document.querySelector('.live-panel');
        if (livePanel) livePanel.style.display = 'block';

        if (livePlayer) livePlayer.style.display = 'none';
        if (offlineNotice) {
          offlineNotice.style.display = 'flex';
          offlineNotice.innerHTML = `
            <div style="text-align:center;padding:32px 24px;max-width:520px;">
              <div style="font-size:2.8rem;margin-bottom:16px;">📡</div>
              <p style="font-family:var(--font-title);font-size:1.1rem;text-transform:uppercase;letter-spacing:1px;color:var(--text);margin-bottom:6px;">We will be live soon</p>
              <p style="font-size:0.9rem;font-weight:600;color:var(--red);margin-bottom:10px;">"${nextTitle}"</p>
              <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:20px;">Scheduled to start around <strong>${timeStr}</strong>. Stay tuned and set a reminder!</p>
              <a href="https://www.youtube.com/watch?v=${nextId}" target="_blank" class="btn btn-primary btn-sm" style="display:inline-flex;gap:8px;">
                <i class="fab fa-youtube"></i> Set a Reminder
              </a>
            </div>
          `;
        }
        if (liveIndicator) {
          liveIndicator.className = 'live-badge is-upcoming';
          const span = liveIndicator.querySelector('span:last-child');
          if (span) { span.textContent = '📡 UPCOMING'; span.style.color = '#c27c00'; }
          const dot = liveIndicator.querySelector('.live-dot');
          if (dot) dot.style.display = 'none';
        }
        if (liveStatusText) liveStatusText.textContent = `Coming up: ${nextTitle}`;
        updateHomeLiveBanner(false);
        // Still show the most recent past live below
        loadRecentLiveReplay();
        return;
      }
    }

    // ── 3. No live & no upcoming → OFFLINE ─────────────────────
    showOffline('MBIRE TV ZIMBABWE is not currently broadcasting on YouTube. Check back soon or browse our recent broadcast below.');
    if (window.loadLiveComments) {
      window.loadLiveComments('live_stream');
    }

  } catch (err) {
    console.error('Error checking live state:', err);
    // Do not call showOffline() on error to prevent live banner/player from disappearing
    // during temporary errors or YouTube API rate limits.
  }
}

// ─── API Fallback View ────────────────────────────────────────
function showVideosFallback(grid) {
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:40px 0;">
      <div style="max-width:900px;margin:0 auto;aspect-ratio:16/9;background:var(--bg-card2);border-radius:var(--radius-lg);overflow:hidden;border:1.5px solid var(--border);">
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed?listType=playlist&list=${YOUTUBE_FALLBACK.uploadsPlaylistId}&rel=0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          title="MBIRE TV ZIMBABWE Playlist">
        </iframe>
      </div>
      <div style="margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:12px;">
        <p style="font-family:var(--font-title);font-size:1.1rem;text-transform:uppercase;letter-spacing:1px;color:var(--text);margin:0;">Recent Uploads Feed</p>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0;max-width:540px;">Watch our latest coverage, talk shows and reports directly from our channels feed overlay.</p>
        <a href="${YOUTUBE_FALLBACK.channelUrl}" target="_blank" class="btn btn-primary" style="display:inline-flex;gap:8px;">
          <i class="fab fa-youtube"></i> Visit Channel Page
        </a>
      </div>
    </div>
  `;
}

// Setup automated re-checking on modal close or layout hooks
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('videoModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.modal-close')) {
        closeVideoModal();
      }
    });
  }
});

// ─── Fetch YouTube Uploads Data only (No Rendering) ──────────
async function fsGetYouTubeVideosData(maxResults = 10) {
  if (!isYouTubeApiKeyConfigured()) {
    return [];
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_FALLBACK.uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_CONFIG.apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    const items = data.items || [];
    if (!items.length) return [];

    const videoIds = items.map(item => item.snippet?.resourceId?.videoId || item.id?.videoId || item.id).filter(Boolean);
    if (videoIds.length) {
      try {
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${YOUTUBE_CONFIG.apiKey}`;
        const statsRes = await fetch(statsUrl);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const statsMap = {};
          (statsData.items || []).forEach(v => {
            statsMap[v.id] = v.statistics;
          });
          items.forEach(item => {
            const vId = item.snippet?.resourceId?.videoId || item.id?.videoId || item.id;
            if (statsMap[vId]) {
              item.statistics = statsMap[vId];
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch video statistics:', err);
      }
    }

    return items;
  } catch (e) {
    console.warn('Error fetching youtube videos data:', e);
    return [];
  }
}
window.fsGetYouTubeVideosData = fsGetYouTubeVideosData;
