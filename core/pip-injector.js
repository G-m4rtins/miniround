// Utilitário isolado que será injetado no contexto da página do usuário

export function checkVideoStatus() {
  function getVideosRecursively(root) {
    let videos = Array.from(root.querySelectorAll('video'));
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) {
        videos = videos.concat(getVideosRecursively(el.shadowRoot));
      }
    }
    return videos;
  }
  
  const inIframe = window !== window.top;
  const hasActivePiP = inIframe 
    ? document.pictureInPictureElement !== null 
    : !!(window.documentPictureInPicture && window.documentPictureInPicture.window);

  return {
    active: hasActivePiP,
    hasVideo: getVideosRecursively(document).length > 0
  };
}

export async function toggleVideoPiP() {
  const isIframe = window !== window.top;
  const isDocumentPiPSupported = ('documentPictureInPicture' in window);

  // Fecha PiP se já estiver aberto
  if (!isIframe && window.documentPictureInPicture && window.documentPictureInPicture.window) {
    try {
      window.documentPictureInPicture.window.close();
      return { active: false, actionTaken: 'exited_document' };
    } catch (e) {
      return { error: e.message };
    }
  }

  if (isIframe && document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture();
      return { active: false, actionTaken: 'exited_native' };
    } catch (e) {
      return { error: e.message };
    }
  }

  // Busca o vídeo recursivamente
  function getVideosRecursively(root) {
    let videos = Array.from(root.querySelectorAll('video'));
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) {
        videos = videos.concat(getVideosRecursively(el.shadowRoot));
      }
    }
    return videos;
  }

  const videos = getVideosRecursively(document);
  if (videos.length === 0) return { hasVideo: false };

  let targetVideo = videos[0];
  let maxArea = 0;
  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > maxArea) {
      maxArea = area;
      targetVideo = v;
    }
  }

  // Híbrido: Se estiver dentro de um iframe (ou se o navegador não suportar Document PiP), cai pro PiP Nativo
  if (isIframe || !isDocumentPiPSupported) {
    try {
      await targetVideo.requestPictureInPicture();
      return { active: true, actionTaken: 'entered_native' };
    } catch (e) {
      return { error: 'Falha no PiP nativo (Iframe): ' + e.message };
    }
  }

  // Se for janela principal, utiliza o Document PiP super customizável
  try {
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: Math.max(targetVideo.clientWidth || 400, 400),
      height: Math.max(targetVideo.clientHeight || 250, 250) + 60
    });

    const originalParent = targetVideo.parentNode;
    const originalNextSibling = targetVideo.nextSibling;
    const originalCssText = targetVideo.style.cssText;

    targetVideo.style.cssText = 'width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; position: static !important; margin: 0 !important; padding: 0 !important; display: block !important; transform: none !important; opacity: 1 !important; visibility: visible !important;';

    const style = pipWindow.document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      
      .player-wrapper { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; }
      video { width: 100%; height: 100%; object-fit: contain; }
      
      .overlay-controls {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4);
        opacity: 0; transition: opacity 0.3s ease;
        display: flex; flex-direction: column; justify-content: center;
      }
      .player-wrapper:hover .overlay-controls, .overlay-controls.force-show { opacity: 1; }

      .center-controls {
        display: flex; align-items: center; justify-content: center; gap: 30px;
        flex: 1;
      }
      
      .icon-btn {
        background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
        color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s, transform 0.1s; backdrop-filter: blur(4px);
      }
      .icon-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.05); }
      .icon-btn:active { transform: scale(0.95); }
      
      .btn-play { width: 64px; height: 64px; }
      .btn-play svg { width: 32px; height: 32px; fill: white; margin-left: 4px; }
      .btn-play.paused svg { margin-left: 0; }
      
      .btn-skip { width: 48px; height: 48px; }
      .btn-skip svg { width: 24px; height: 24px; fill: white; }
      
      .bottom-controls {
        position: absolute; bottom: 0; left: 0; right: 0;
        padding: 0 16px 16px 16px;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
      }

      .time-slider-container {
        position: relative; width: 100%; height: 12px; display: flex; align-items: center; margin-bottom: 8px;
        cursor: pointer;
      }
      .time-slider {
        position: absolute; width: 100%; -webkit-appearance: none; appearance: none;
        background: transparent; margin: 0; height: 100%; outline: none; z-index: 2; cursor: pointer;
      }
      .time-slider::-webkit-slider-thumb {
        -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #e53935;
        cursor: pointer; transition: transform 0.1s; transform: scale(0);
      }
      .time-slider-container:hover .time-slider::-webkit-slider-thumb { transform: scale(1); }
      
      .slider-track {
        position: absolute; top: 5px; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px;
      }
      .slider-fill {
        position: absolute; top: 5px; left: 0; height: 3px; background: #e53935; border-radius: 2px;
      }

      .bottom-bar {
        display: flex; align-items: center; justify-content: space-between;
      }
      
      .time-text { color: #fff; font-size: 13px; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 500; }
      
      .right-controls { display: flex; align-items: center; gap: 16px; }
      
      .vol-wrapper { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .vol-wrapper svg { width: 20px; height: 20px; fill: white; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
      .vol-slider { width: 60px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.3); outline: none; border-radius: 2px; cursor: pointer; height: 3px; }
      .vol-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 10px; width: 10px; border-radius: 50%; background: #fff; cursor: pointer; }
      
      .btn-close { background: none; border: none; cursor: pointer; padding: 0; display: flex; }
      .btn-close svg { width: 22px; height: 22px; fill: white; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); transition: transform 0.2s; }
      .btn-close:hover svg { transform: scale(1.1); }
    `;
    pipWindow.document.head.append(style);

    const playerWrapper = pipWindow.document.createElement('div');
    playerWrapper.className = 'player-wrapper';
    playerWrapper.append(targetVideo);

    const controls = pipWindow.document.createElement('div');
    controls.className = 'overlay-controls';
    
    const isPaused = targetVideo.paused;
    
    const formatTime = (time) => {
      if (isNaN(time) || !isFinite(time)) return '0:00';
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    };

    const maxDuration = (isNaN(targetVideo.duration) || !isFinite(targetVideo.duration)) ? 100 : targetVideo.duration;
    const progressPercent = (targetVideo.currentTime / maxDuration) * 100 || 0;

    const playSvg = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseSvg = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const rewindSvg = `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>`;
    const forwardSvg = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
    const volSvg = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    const closeSvg = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

    controls.innerHTML = `
      <div class="center-controls">
        <button class="icon-btn btn-skip" id="btn-rewind">${rewindSvg}</button>
        <button class="icon-btn btn-play ${isPaused ? '' : 'paused'}" id="btn-play">
          ${isPaused ? playSvg : pauseSvg}
        </button>
        <button class="icon-btn btn-skip" id="btn-forward">${forwardSvg}</button>
      </div>
      <div class="bottom-controls">
        <div class="time-slider-container">
          <div class="slider-track"></div>
          <div class="slider-fill" id="slider-fill" style="width: ${progressPercent}%"></div>
          <input type="range" id="time-slider" class="time-slider" min="0" max="${maxDuration}" value="${targetVideo.currentTime || 0}">
        </div>
        <div class="bottom-bar">
          <span class="time-text"><span id="time-current">${formatTime(targetVideo.currentTime)}</span> / <span id="time-duration">${formatTime(targetVideo.duration)}</span></span>
          <div class="right-controls">
            <div class="vol-wrapper">
              ${volSvg}
              <input type="range" id="vol-slider" class="vol-slider" min="0" max="1" step="0.05" value="${targetVideo.volume !== undefined ? targetVideo.volume : 1}">
            </div>
            <button class="icon-btn btn-close" id="btn-close" title="Fechar MiniPlayer">${closeSvg}</button>
          </div>
        </div>
      </div>
    `;

    playerWrapper.append(controls);
    pipWindow.document.body.append(playerWrapper);

    // Eventos
    const btnPlay = pipWindow.document.getElementById('btn-play');
    const btnRewind = pipWindow.document.getElementById('btn-rewind');
    const btnForward = pipWindow.document.getElementById('btn-forward');
    const btnClose = pipWindow.document.getElementById('btn-close');
    const timeSlider = pipWindow.document.getElementById('time-slider');
    const sliderFill = pipWindow.document.getElementById('slider-fill');
    const timeCurrent = pipWindow.document.getElementById('time-current');
    const timeDuration = pipWindow.document.getElementById('time-duration');
    const volSlider = pipWindow.document.getElementById('vol-slider');

    let isDraggingTime = false;

    const updatePlayState = () => {
      btnPlay.className = `icon-btn btn-play ${targetVideo.paused ? '' : 'paused'}`;
      btnPlay.innerHTML = targetVideo.paused ? playSvg : pauseSvg;
    };

    btnPlay.addEventListener('click', () => {
      if (targetVideo.paused) {
        targetVideo.play().catch(console.error);
      } else {
        targetVideo.pause();
      }
    });

    targetVideo.addEventListener('play', updatePlayState);
    targetVideo.addEventListener('pause', updatePlayState);

    // Botoes de Skip
    btnRewind.addEventListener('click', () => { targetVideo.currentTime = Math.max(0, targetVideo.currentTime - 10); });
    btnForward.addEventListener('click', () => { targetVideo.currentTime = Math.min(targetVideo.duration || targetVideo.currentTime + 10, targetVideo.currentTime + 10); });

    // Fechar PiP
    btnClose.addEventListener('click', () => pipWindow.close());

    // Tempo e Slider de Progresso
    targetVideo.addEventListener('loadedmetadata', () => {
      if (!isNaN(targetVideo.duration) && isFinite(targetVideo.duration)) {
        timeSlider.max = targetVideo.duration;
        timeDuration.textContent = formatTime(targetVideo.duration);
      }
    });

    targetVideo.addEventListener('timeupdate', () => {
      if (!isDraggingTime) {
        timeSlider.value = targetVideo.currentTime;
        timeCurrent.textContent = formatTime(targetVideo.currentTime);
        
        const dur = isNaN(targetVideo.duration) ? 100 : targetVideo.duration;
        sliderFill.style.width = `${(targetVideo.currentTime / dur) * 100}%`;

        if (!isNaN(targetVideo.duration) && isFinite(targetVideo.duration) && timeDuration.textContent === '0:00') {
           timeSlider.max = targetVideo.duration;
           timeDuration.textContent = formatTime(targetVideo.duration);
        }
      }
    });

    timeSlider.addEventListener('input', (e) => {
      isDraggingTime = true;
      timeCurrent.textContent = formatTime(e.target.value);
      const dur = isNaN(targetVideo.duration) ? 100 : targetVideo.duration;
      sliderFill.style.width = `${(e.target.value / dur) * 100}%`;
    });

    timeSlider.addEventListener('change', (e) => {
      isDraggingTime = false;
      targetVideo.currentTime = e.target.value;
    });

    // Volume
    volSlider.addEventListener('input', (e) => {
      targetVideo.volume = e.target.value;
    });

    targetVideo.addEventListener('volumechange', () => {
      volSlider.value = targetVideo.volume;
    });

    pipWindow.addEventListener('pagehide', () => {
      targetVideo.style.cssText = originalCssText;
      if (originalNextSibling) {
        originalParent.insertBefore(targetVideo, originalNextSibling);
      } else {
        originalParent.append(targetVideo);
      }
    });

    return { active: true, actionTaken: 'entered_document' };
  } catch (e) {
    return { error: 'Erro ao abrir Document PiP: ' + e.message };
  }
}
