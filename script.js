const DOM = {
    overlay: document.getElementById('auth-overlay'),
    dashboard: document.getElementById('dashboard'),
    sessionName: document.getElementById('session-name'),
    sessionPin: document.getElementById('session-pin'),
    startBtn: document.getElementById('start-btn'),
    statusSession: document.getElementById('status-session'),
    statusCount: document.getElementById('status-count'),
    statusStorage: document.getElementById('status-storage'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    searchInput: document.getElementById('search-input'),
    refreshBtn: document.getElementById('refresh-btn'),
    fileGrid: document.getElementById('file-grid'),
    logContainer: document.getElementById('log-container'),
    toastContainer: document.getElementById('toast-container')
};

let currentSession = '';
let currentPin = '';

// Initialize Session
DOM.startBtn.addEventListener('click', () => {
    const name = DOM.sessionName.value.trim();
    const pin = DOM.sessionPin.value.trim();
    
    if (!name || !pin) return showToast('SESSION_ID and ACCESS_PIN required.', 'error');
    
    currentSession = name;
    currentPin = pin;
    
    DOM.statusSession.textContent = name;
    DOM.overlay.classList.add('hidden');
    DOM.dashboard.classList.remove('hidden');
    
    addLog(`Session [${name}] initialized.`);
    showToast('SYSTEM CONNECTED', 'success');
    
    fetchFiles();
    fetchStorage();
});

// Drag and Drop Uploads
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    DOM.dropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
    });
});

['dragenter', 'dragover'].forEach(evt => {
    DOM.dropZone.addEventListener(evt, () => DOM.dropZone.classList.add('dragover'));
});

['dragleave', 'drop'].forEach(evt => {
    DOM.dropZone.addEventListener(evt, () => DOM.dropZone.classList.remove('dragover'));
});

DOM.dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
DOM.fileInput.addEventListener('change', e => handleFiles(e.target.files));

function handleFiles(files) {
    if (!files.length) return;
    const formData = new FormData();
    formData.append('session', currentSession);
    formData.append('pin', currentPin);
    
    for (let file of files) {
        formData.append('files', file);
    }
    
    uploadData(formData);
}

function uploadData(formData) {
    DOM.progressContainer.classList.remove('hidden');
    DOM.progressBar.style.width = '0%';
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    
    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            DOM.progressBar.style.width = percentComplete + '%';
        }
    };
    
    xhr.onload = () => {
        DOM.progressContainer.classList.add('hidden');
        if (xhr.status === 200) {
            showToast('UPLOAD_COMPLETE', 'success');
            addLog(`Uploaded ${formData.getAll('files').length} file(s).`);
            fetchFiles();
            fetchStorage();
            DOM.fileInput.value = ''; // Reset input
        } else {
            showToast('UPLOAD_FAILED: ' + xhr.responseText, 'error');
            addLog('Upload failed.', 'error');
        }
    };
    
    xhr.onerror = () => {
        DOM.progressContainer.classList.add('hidden');
        showToast('NETWORK_ERROR', 'error');
    };
    
    xhr.send(formData);
}

// File Explorer
function fetchFiles() {
    fetch(`/files?session=${encodeURIComponent(currentSession)}&pin=${encodeURIComponent(currentPin)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            renderFiles(data.files);
            DOM.statusCount.textContent = data.files.length;
            addLog('Directory listing refreshed.');
        })
        .catch(err => showToast(err.message, 'error'));
}

function renderFiles(files) {
    DOM.fileGrid.innerHTML = '';
    const filter = DOM.searchInput.value.toLowerCase();
    
    files.filter(f => f.name.toLowerCase().includes(filter)).forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';
        
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        card.innerHTML = `
            <div class="file-name">${file.name}</div>
            <div class="file-size">${sizeMB} MB</div>
            <div class="file-actions">
                <a href="/download?session=${encodeURIComponent(currentSession)}&pin=${encodeURIComponent(currentPin)}&file=${encodeURIComponent(file.name)}" class="cyber-btn" download target="_blank">DL</a>
                <button class="cyber-btn btn-del" onclick="deleteFile('${file.name}')">DEL</button>
            </div>
        `;
        DOM.fileGrid.appendChild(card);
    });
}

window.deleteFile = function(filename) {
    if (!confirm(`> DELETE_FILE: ${filename}?`)) return;
    
    fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: currentSession, pin: currentPin, file: filename })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        showToast('FILE_DELETED', 'success');
        addLog(`Deleted file: ${filename}`);
        fetchFiles();
        fetchStorage();
    })
    .catch(err => showToast(err.message, 'error'));
};

DOM.refreshBtn.addEventListener('click', fetchFiles);
DOM.searchInput.addEventListener('input', fetchFiles);

// Storage Status
function fetchStorage() {
    fetch('/storage')
        .then(res => res.json())
        .then(data => {
            if(data.free) {
                DOM.statusStorage.textContent = data.free;
            }
        }).catch(err => console.error(err));
}

// Utilities
function addLog(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
    DOM.logContainer.prepend(entry);
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = `> ${msg}`;
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
