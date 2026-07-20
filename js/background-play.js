/**
 * MBIRE TV ZIMBABWE — Background Playback Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Keeps video/audio playing when the user:
 *   • Minimizes the browser
 *   • Locks/turns off the phone screen
 *   • Switches to another app
 *
 * Techniques used:
 *   1. Silent AudioContext   – Keeps the browser's audio session alive so the
 *      OS never suspends playback (the key trick for mobile devices)
 *   2. MediaSession API      – Registers the current media with the OS so the
 *      lock-screen controls work and the system doesn't kill the session
 *   3. Page Visibility API   – Detects when the tab/app is hidden and attempts
 *      to resume any paused YouTube iframes via postMessage
 *   4. YouTube iframe params – Ensures iframes are created with playsinline=1
 *      so iOS Safari doesn't forcibly pause them
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ─── 1. Silent AudioContext ──────────────────────────────────────────── */
  // Playing a completely silent audio node through the Web Audio API keeps
  // the browser's audio session registered with the OS. Without this, mobile
  // browsers (especially iOS Safari) will suspend media when the screen locks.
  let _audioCtx = null;
  let _silentSource = null;
  let _gainNode = null;

  function startSilentAudio() {
    try {
      if (_audioCtx) return; // already running
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      _audioCtx   = new AudioCtx();
      _gainNode   = _audioCtx.createGain();
      _gainNode.gain.value = 0.001; // nearly silent — not true zero (avoids browser optimisation)
      _gainNode.connect(_audioCtx.destination);

      // Create a buffer of pure silence
      const bufferSize = _audioCtx.sampleRate * 2; // 2 seconds
      const buffer     = _audioCtx.createBuffer(1, bufferSize, _audioCtx.sampleRate);
      // Buffer is already zeroed — that is our silence

      function playLoop() {
        if (!_audioCtx) return;
        _silentSource = _audioCtx.createBufferSource();
        _silentSource.buffer = buffer;
        _silentSource.connect(_gainNode);
        _silentSource.loop = true;
        _silentSource.start(0);
      }

      // Resume context if suspended (required after user interaction on iOS)
      if (_audioCtx.state === 'suspended') {
        _audioCtx.resume().then(playLoop);
      } else {
        playLoop();
      }

      console.log('[BG-Play] Silent audio context started — audio session is active');
    } catch (e) {
      console.warn('[BG-Play] Silent audio context failed:', e);
    }
  }

  function resumeAudioContext() {
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
  }

  // Start silent audio on first user interaction (required by browser policy)
  ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(evt => {
    document.addEventListener(evt, function onFirstInteraction() {
      startSilentAudio();
      // Remove after first trigger
      ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(e => {
        document.removeEventListener(e, onFirstInteraction);
      });
    }, { once: false, passive: true });
  });


  /* ─── 2. MediaSession API ─────────────────────────────────────────────── */
  // Registers the current media with the OS so the lock-screen shows playback
  // controls and the system knows media is actively playing.
  function registerMediaSession(title, artist, artwork) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  title  || 'MBIRE TV ZIMBABWE',
      artist: artist || 'Zimbabwe\'s Independent Channel',
      album:  'MBIRE TV',
      artwork: artwork || [
        { src: window.location.origin + '/images/logo.png', sizes: '256x256', type: 'image/png' },
        { src: window.location.origin + '/images/logo.png', sizes: '512x512', type: 'image/png' },
      ]
    });

    // Handle lock-screen play/pause buttons
    navigator.mediaSession.setActionHandler('play', () => {
      resumeAudioContext();
      resumeAllYouTubeIframes('play');
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      resumeAllYouTubeIframes('pause');
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      resumeAllYouTubeIframes('pause');
    });

    navigator.mediaSession.playbackState = 'playing';
    console.log('[BG-Play] MediaSession registered for OS lock-screen controls');
  }


  /* ─── 3. YouTube iframe communication ────────────────────────────────── */
  // YouTube iframes accept postMessage commands from the parent page.
  // We use the YouTube Iframe Player API's postMessage protocol to send
  // play/pause commands without needing to reload the iframe.

  function sendYouTubeCommand(iframe, command) {
    try {
      const msg = JSON.stringify({ event: 'command', func: command, args: [] });
      iframe.contentWindow.postMessage(msg, '*');
    } catch (e) {
      // Cross-origin restrictions — fail silently
    }
  }

  function resumeAllYouTubeIframes(action) {
    const func = action === 'play' ? 'playVideo' : 'pauseVideo';
    document.querySelectorAll('iframe[src*="youtube"]').forEach(iframe => {
      sendYouTubeCommand(iframe, func);
    });
  }

  // Make all existing and future YouTube iframes use enablejsapi=1 & playsinline=1
  // so postMessage commands and iOS inline playback both work
  function patchYouTubeIframes() {
    document.querySelectorAll('iframe[src*="youtube"]').forEach(iframe => {
      let src = iframe.src;
      if (!src) return;
      if (!src.includes('enablejsapi=1')) {
        src += (src.includes('?') ? '&' : '?') + 'enablejsapi=1';
      }
      if (!src.includes('playsinline=1')) {
        src += '&playsinline=1';
      }
      if (src !== iframe.src) {
        iframe.src = src;
      }
      // Ensure the iframe has the right allow attribute
      const allow = iframe.getAttribute('allow') || '';
      if (!allow.includes('autoplay')) {
        iframe.setAttribute('allow', allow + '; autoplay; picture-in-picture; fullscreen');
      }
    });
  }


  /* ─── 4. Page Visibility API ─────────────────────────────────────────── */
  // When the page becomes hidden (tab switch, screen lock, app switch),
  // attempt to keep video playing by resuming the audio context and sending
  // a play command to all YouTube iframes.

  let _hiddenPlayInterval = null;
  let _wasPlayingBeforeHide = false;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is now hidden — resume audio context to prevent suspension
      resumeAudioContext();
      _wasPlayingBeforeHide = true;
      // Small delay then try to resume iframes (some browsers need this)
      setTimeout(() => {
        resumeAllYouTubeIframes('play');
        if (navigator.mediaSession) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }, 300);

      // Periodically force playback to bypass browser hidden-tab auto-pauses
      if (!_hiddenPlayInterval) {
        _hiddenPlayInterval = setInterval(() => {
          if (document.hidden) {
            resumeAllYouTubeIframes('play');
            resumeAudioContext();
          }
        }, 1500);
      }
      console.log('[BG-Play] Page hidden — keeping audio session alive');
    } else {
      // Page is visible again
      if (_hiddenPlayInterval) {
        clearInterval(_hiddenPlayInterval);
        _hiddenPlayInterval = null;
      }
      resumeAudioContext();
      if (_wasPlayingBeforeHide) {
        resumeAllYouTubeIframes('play');
      }
      console.log('[BG-Play] Page visible again');
    }
  });

  // Keep audio context alive using a recurring heartbeat
  setInterval(() => {
    resumeAudioContext();
    if (document.hidden && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }, 10000); // every 10 seconds


  /* ─── 5. MutationObserver: Patch iframes as they are added dynamically ─ */
  // Since YouTube iframes are loaded dynamically by youtube.js, we watch the
  // DOM for new iframes and patch them as soon as they appear.
  const observer = new MutationObserver(() => {
    patchYouTubeIframes();
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Also patch any already-existing iframes on load
  document.addEventListener('DOMContentLoaded', () => {
    patchYouTubeIframes();
  });
  patchYouTubeIframes(); // run immediately too


  /* ─── 6. Listen for YouTube iframe state changes via postMessage ──────── */
  // When a YouTube video starts playing, activate the full background session
  window.addEventListener('message', (event) => {
    try {
      const data = (typeof event.data === 'string') ? JSON.parse(event.data) : event.data;
      if (!data) return;

      // YouTube sends { event: 'infoDelivery', info: { playerState: 1 } } when playing
      if (data.event === 'infoDelivery' && data.info && data.info.playerState === 1) {
        // Player state 1 = playing
        startSilentAudio();

        // Grab video title if available
        const title  = data.info.title        || 'MBIRE TV ZIMBABWE';
        const artist = data.info.author       || 'Zimbabwe\'s Independent Channel';
        registerMediaSession(title, artist);

        console.log('[BG-Play] YouTube video started — background session activated');
      }

      // State 2 = paused, 0 = ended
      if (data.event === 'infoDelivery' && data.info && [0, 2].includes(data.info.playerState)) {
        if (navigator.mediaSession) {
          navigator.mediaSession.playbackState = data.info.playerState === 2 ? 'paused' : 'none';
        }
      }
    } catch (_) {
      // Not a YouTube message — ignore
    }
  });


  /* ─── 7. Expose public API ───────────────────────────────────────────── */
  window.MbireBGPlay = {
    start:           startSilentAudio,
    register:        registerMediaSession,
    resumeIframes:   resumeAllYouTubeIframes,
    patchIframes:    patchYouTubeIframes,
  };

  console.log('[BG-Play] MBIRE TV background playback module loaded ✅');

})();
