import { checkVideoStatus, toggleVideoPiP } from '../core/pip-injector.js';

const toggleBtn = document.getElementById('toggle-btn');
const btnText = document.getElementById('btn-text');
const btnIcon = document.getElementById('btn-icon');

const statusCard = document.getElementById('status-card');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');

const errorMsg = document.getElementById('error-msg');

const ICON_PLAY_OUTLINE = '<path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82zM10 8.64L15.27 12 10 15.36V8.64z"/>';
const ICON_PLAY_SOLID = '<path d="M8 5v14l11-7z"/>';
const ICON_STOP_SOLID = '<path d="M6 6h12v12H6z"/>';

function setError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = msg ? 'block' : 'none';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function updateUI({ active, hasVideo }) {
  setError('');
  if (active) {
    statusCard.className = 'status-card state-active';
    statusTitle.textContent = 'MiniRound ativo';
    statusDesc.textContent = 'O vídeo está em modo flutuante.';
    
    toggleBtn.className = 'main-btn btn-danger';
    btnText.textContent = 'Fechar MiniRound';
    btnIcon.innerHTML = ICON_STOP_SOLID;
    toggleBtn.disabled = false;
  } else if (hasVideo) {
    statusCard.className = 'status-card state-found';
    statusTitle.textContent = 'Vídeo encontrado';
    statusDesc.textContent = 'Pronto para ativar o modo flutuante.';
    
    toggleBtn.className = 'main-btn btn-primary';
    btnText.textContent = 'Ativar MiniRound';
    btnIcon.innerHTML = ICON_PLAY_SOLID;
    toggleBtn.disabled = false;
  } else {
    statusCard.className = 'status-card state-none';
    statusTitle.textContent = 'Nenhum vídeo na página';
    statusDesc.textContent = 'Adicione um vídeo para começar a visualizar.';
    
    toggleBtn.className = 'main-btn';
    btnText.textContent = 'Sem vídeo';
    btnIcon.innerHTML = ICON_PLAY_OUTLINE;
    toggleBtn.disabled = true;
  }
}

async function init() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: checkVideoStatus
    });

    let active = false;
    let hasVideo = false;

    if (results) {
      for (const res of results) {
        if (res.result) {
          if (res.result.active) active = true;
          if (res.result.hasVideo) hasVideo = true;
        }
      }
    }
    updateUI({ active, hasVideo });
  } catch (e) {
    updateUI({ active: false, hasVideo: false });
    statusDesc.textContent = 'Página restrita pelo navegador.';
  }
}

toggleBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: toggleVideoPiP
    });

    let active = false;
    let hasVideo = false;
    let lastError = null;

    if (results) {
      for (const res of results) {
        if (res.result) {
          if (res.result.actionTaken && res.result.actionTaken.startsWith('entered')) active = true;
          if (res.result.actionTaken && res.result.actionTaken.startsWith('exited')) active = false;
          if (res.result.hasVideo !== false) hasVideo = true;
          if (res.result.error) lastError = res.result.error;
        }
      }
    }

    if (lastError && !active) {
      setError('Erro: ' + lastError);
    } else {
      if (active) hasVideo = true;
      updateUI({ active, hasVideo });
    }
  } catch (e) {
    setError('Erro de permissão ou aba restrita.');
  }
});

init();
