// == MODAL HTML + CSS ==
function injectProgressModal() {
    if (document.getElementById('fina-progress-modal')) return; // éviter doublon

    const modal = document.createElement('div');
    modal.id = 'fina-progress-modal';
    modal.innerHTML = `
        <div class="fina-modal-content">
            <span class="fina-close" id="fina-modal-close">&times;</span>
            <h2 id="fina-modal-title">Synchronisation en cours...</h2>
            <div id="fina-modal-status"></div>
            <div class="fina-progress-bar-bg">
                <div class="fina-progress-bar" id="fina-progress-bar"></div>
            </div>
            <pre id="fina-modal-log" style="max-height:200px;overflow:auto;background:#222;padding:8px;border-radius:4px;"></pre>
        </div>
    `;
    document.body.appendChild(modal);

    // CSS
    const style = document.createElement('style');
    style.textContent = `
#fina-progress-modal {
    position: fixed; z-index: 99999; left: 0; top: 0; width: 100vw; height: 100vh;
    background: rgba(30,30,30,0.7); display: flex; align-items: center; justify-content: center;
}
.fina-modal-content {
    background: #23272e; color: #d4d4d4; padding: 24px 32px; border-radius: 8px; min-width: 350px; box-shadow: 0 2px 16px #000a;
    position: relative; max-width: 90vw;
}
.fina-close {
    position: absolute; right: 12px; top: 8px; font-size: 28px; cursor: pointer; color: #aaa;
}
.fina-close:hover { color: #fff; }
.fina-progress-bar-bg {
    width: 100%; height: 18px; background: #444; border-radius: 8px; margin: 18px 0 8px 0;
}
.fina-progress-bar {
    height: 100%; width: 0%; background: linear-gradient(90deg,#000,#F1C086); border-radius: 8px;
    transition: width 0.3s;
}
#fina-modal-status { margin-bottom: 6px; }
    `;
    document.head.appendChild(style);

    // Fermeture
    document.getElementById('fina-modal-close').onclick = () => {
        modal.remove();
        style.remove();
    };
}

// == API DE MISE À JOUR ==
function updateProgressModal({ title, status, progress, log }) {
    if (!document.getElementById('fina-progress-modal')) injectProgressModal();
    if (title) document.getElementById('fina-modal-title').textContent = title;
    if (status) document.getElementById('fina-modal-status').textContent = status;
    if (typeof progress === 'number') {
        document.getElementById('fina-progress-bar').style.width = `${progress}%`;
    }
    if (log) {
        const logElem = document.getElementById('fina-modal-log');
        logElem.textContent += log + '\n';
        logElem.scrollTop = logElem.scrollHeight;
    }
}

// Rendez les fonctions accessibles globalement
window.injectProgressModal = injectProgressModal;
window.updateProgressModal = updateProgressModal;