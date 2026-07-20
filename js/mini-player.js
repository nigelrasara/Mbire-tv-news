/**
 * MBIRE TV ZIMBABWE — Persistent Mini Player (Picture-in-Picture)
 * ─────────────────────────────────────────────────────────────────────
 * When a user starts watching a video (live or on-demand) and navigates
 * to another page on the site, the video continues playing in a small
 * draggable floating player in the bottom-right corner.
 *
 * API:
 *   MbireMiniPlayer.show(videoId, title, isLive)  – start tracking a video
 *   MbireMiniPlayer.close()                        – stop & clear
 *   MbireMiniPlayer.goToSource()                   – navigate to the video page
 * ─────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'mbire_pip_state';
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  /* ─── Inject CSS ───────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #mbire-pip {
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 288px;
      background: #0f0f1a;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.08);
      z-index: 99999;
      transform: translateY(140%) scale(0.85);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
      cursor: default;
      user-select: none;
    }
    #mbire-pip.pip-visible {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    #mbire-pip.pip-dragging {
      transition: none;
      cursor: grabbing;
    }

    /* Header */
    .pip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px 7px;
      background: #16213e;
      cursor: grab;
    }
    .pip-header:active { cursor: grabbing; }
    .pip-branding {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pip-logo-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cc0000;
      flex-shrink: 0;
    }
    .pip-live .pip-logo-dot {
      animation: pipDotPulse 1s ease-in-out infinite;
    }
    @keyframes pipDotPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(204,0,0,0.7); }
      50%       { box-shadow: 0 0 0 5px rgba(204,0,0,0); }
    }
    .pip-title {
      font-size: 0.7rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 168px;
      font-family: 'Oswald', 'Bebas Neue', sans-serif;
      letter-spacing: 0.5px;
    }
    .pip-btns {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .pip-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      line-height: 1;
    }
    .pip-btn:hover { background: rgba(255,255,255,0.22); }
    .pip-btn-expand:hover { background: rgba(74,108,247,0.5) !important; }
    .pip-btn-close:hover  { background: rgba(204,0,0,0.65) !important; }

    /* Video frame */
    .pip-video {
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      display: block;
    }
    .pip-video iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    /* Footer */
    .pip-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 10px 6px;
      background: #16213e;
    }
    .pip-badge {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #cc0000;
    }
    #mbire-pip:not(.pip-live) .pip-badge { color: #4a6cf7; }
    .pip-go-hint {
      font-size: 0.6rem;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      transition: color 0.2s;
    }
    .pip-go-hint:hover { color: rgba(255,255,255,0.7); }

    /* Mobile tweaks */
    @media (max-width: 480px) {
      #mbire-pip { width: 240px; bottom: 70px; right: 10px; }
      .pip-title { max-width: 130px; }
    }
  `;
  document.head.appendChild(style);

  /* ─── State ────────────────────────────────────────────────────── */
  let _dragState = null;

  /* ─── Create & inject DOM ──────────────────────────────────────── */
  function buildDOM(state) {
    const old = document.getElementById('mbire-pip');
    if (old) old.remove();

    const pip = document.createElement('div');
    pip.id = 'mbire-pip';
    if (state.isLive) pip.classList.add('pip-live');

    pip.innerHTML = `
      <div class="pip-header" id="pipHeader">
        <div class="pip-branding">
          <div class="pip-logo-dot"></div>
          <span class="pip-title" id="pipTitle">${escapeHtml(state.title || 'MBIRE TV')}</span>
        </div>
        <div class="pip-btns">
          <button class="pip-btn pip-btn-expand" title="Go to video" onclick="MbireMiniPlayer.goToSource()">⤢</button>
          <button class="pip-btn pip-btn-close"  title="Stop video"  onclick="MbireMiniPlayer.close()">✕</button>
        </div>
      </div>
      <div class="pip-video">
        <iframe id="pipIframe"
          src="https://www.youtube.com/embed/${state.videoId}?autoplay=1&rel=0&enablejsapi=1&playsinline=1"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen>
        </iframe>
      </div>
      <div class="pip-footer">
        <span class="pip-badge">${state.isLive ? '🔴 LIVE NOW' : '▶ PLAYING'}</span>
        <span class="pip-go-hint" onclick="MbireMiniPlayer.goToSource()">Tap to expand ›</span>
      </div>
    `;

    document.body.appendChild(pip);
    makeDraggable(pip);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => pip.classList.add('pip-visible'));
    });

    return pip;
  }

  /* ─── Drag support ─────────────────────────────────────────────── */
  function makeDraggable(pip) {
    const header = pip.querySelector('#pipHeader');

    function onStart(clientX, clientY) {
      const rect = pip.getBoundingClientRect();
      _dragState = {
        startX:      clientX,
        startY:      clientY,
        startRight:  window.innerWidth  - rect.right,
        startBottom: window.innerHeight - rect.bottom
      };
      pip.classList.add('pip-dragging');
    }

    function onMove(clientX, clientY) {
      if (!_dragState) return;
      const dx = clientX - _dragState.startX;
      const dy = clientY - _dragState.startY;
      const newRight  = Math.max(0, Math.min(window.innerWidth  - pip.offsetWidth,  _dragState.startRight  - dx));
      const newBottom = Math.max(0, Math.min(window.innerHeight - pip.offsetHeight, _dragState.startBottom + dy));
      pip.style.right  = newRight  + 'px';
      pip.style.bottom = newBottom + 'px';
    }

    function onEnd() {
      _dragState = null;
      pip.classList.remove('pip-dragging');
    }

    // Mouse
    header.addEventListener('mousedown', (e) => { onStart(e.clientX, e.clientY); e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (_dragState) onMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', onEnd);

    // Touch
    header.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!_dragState) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', onEnd);
  }

  /* ─── Public API ───────────────────────────────────────────────── */

  /**
   * Start tracking a video so mini player can appear on other pages.
   * Call this whenever a video starts playing.
   */
  function show(videoId, title, isLive) {
    if (!videoId) return;
    const state = {
      videoId,
      title:      title || 'MBIRE TV ZIMBABWE',
      isLive:     !!isLive,
      sourcePage: currentPage
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}

    // Don't show mini player on the same page as the full player
    // (video is already visible full-size)
  }

  /**
   * Dismiss mini player and clear state (user explicitly stopped video).
   */
  function close() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    const pip = document.getElementById('mbire-pip');
    if (pip) {
      pip.classList.remove('pip-visible');
      setTimeout(() => pip.remove(), 350);
    }
  }

  /**
   * Navigate user back to where the full video is.
   */
  function goToSource() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const state = JSON.parse(raw);
      const target = state.isLive ? 'live.html' : 'videos.html';
      window.location.href = target;
    } catch (_) {}
  }

  /* ─── Auto-restore on page load ─────────────────────────────────── */
  function tryRestore() {
    let state;
    try { state = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return; }
    if (!state || !state.videoId) return;

    // If user is back on the source page — hide mini player, full player is there
    if (state.sourcePage === currentPage) return;

    // If live stream and user is on live.html — hide, full live player is running
    if (state.isLive && currentPage === 'live.html') return;

    // Otherwise show mini player
    buildDOM(state);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRestore);
  } else {
    setTimeout(tryRestore, 400);
  }

  /* ─── Helper ─────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── Expose globally ────────────────────────────────────────── */
  window.MbireMiniPlayer = { show, close, goToSource };

  console.log('[MiniPlayer] MBIRE TV mini player loaded ✅');

})();
