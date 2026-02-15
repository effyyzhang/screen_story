// API base URL
const API_BASE = 'http://localhost:3000/api';

// State
let currentView = 'sessions';
let allSessions = [];
let captureInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCaptureControls();
  initModals();
  initSearch();
  initExport();

  // Load initial data
  loadStats();
  loadSessions();
  checkCaptureStatus();

  // Poll capture status every 5 seconds
  setInterval(checkCaptureStatus, 5000);
});

// ==================== Navigation ====================

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  currentView = view;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Update content
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `${view}View`);
  });

  // Load view-specific data
  if (view === 'sessions') loadSessions();
  if (view === 'export') loadExportSessions();
}

// ==================== Stats ====================

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const stats = await res.json();

    const statItems = document.querySelectorAll('.stat-item');
    statItems[0].querySelector('.stat-value').textContent = stats.total_sessions || 0;
    statItems[1].querySelector('.stat-value').textContent = stats.total_screenshots || 0;
    statItems[2].querySelector('.stat-value').textContent = stats.analyzed_screenshots || 0;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// ==================== Sessions ====================

async function loadSessions() {
  try {
    const res = await fetch(`${API_BASE}/sessions`);
    allSessions = await res.json();

    renderSessions(allSessions);
  } catch (error) {
    console.error('Failed to load sessions:', error);
    document.getElementById('sessionsGrid').innerHTML =
      '<div class="empty-state">Failed to load sessions</div>';
  }
}

function renderSessions(sessions) {
  const grid = document.getElementById('sessionsGrid');

  if (sessions.length === 0) {
    grid.innerHTML = '<div class="empty-state">No sessions yet. Start capturing!</div>';
    return;
  }

  grid.innerHTML = sessions.map(session => {
    const avgRelevance = Math.round((session.avg_relevance || 0) * 100);
    const date = new Date(session.created_at).toLocaleDateString();

    return `
      <div class="session-card" onclick="viewSession(${session.id})">
        <h3>${session.name}</h3>
        <div class="session-meta">
          <div>${session.description || 'No description'}</div>
          <div>📅 ${date}</div>
        </div>
        <div class="session-stats">
          <div class="session-stat">
            <div class="session-stat-value">${session.screenshot_count}</div>
            <div class="session-stat-label">Screenshots</div>
          </div>
          <div class="session-stat">
            <div class="session-stat-value">${session.analyzed_count}</div>
            <div class="session-stat-label">Analyzed</div>
          </div>
          <div class="session-stat">
            <div class="session-stat-value">${avgRelevance}%</div>
            <div class="session-stat-label">Relevance</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Session filter
document.getElementById('sessionFilter')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allSessions.filter(s =>
    s.name.toLowerCase().includes(query) ||
    (s.description || '').toLowerCase().includes(query)
  );
  renderSessions(filtered);
});

// ==================== Session Detail ====================

async function viewSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const session = await res.json();

    const modal = document.getElementById('sessionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = session.name;

    const analyzed = session.screenshots.filter(s => s.analyzed).length;
    const avgRelevance = session.screenshots.length > 0
      ? Math.round(session.screenshots.reduce((sum, s) => sum + (s.relevance_score || 0), 0) / session.screenshots.length * 100)
      : 0;

    modalBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${session.description || 'No description'}</p>
        <p style="color: var(--text-secondary); font-size: 0.875rem;">
          ${session.screenshots.length} screenshots • ${analyzed} analyzed • ${avgRelevance}% avg relevance
        </p>
      </div>

      ${analyzed === 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <button class="btn btn-primary" onclick="analyzeSession('${session.name}')">
            Analyze Session
          </button>
        </div>
      ` : ''}

      <div class="screenshot-grid">
        ${session.screenshots.map(screenshot => {
          const relevance = screenshot.relevance_display || 0;
          const relevanceClass = relevance >= 70 ? 'relevance-high' : relevance >= 40 ? 'relevance-medium' : 'relevance-low';
          const imgPath = screenshot.file_path.replace('/Users/effyzhang/Documents/effyos/screen_story/sessions/', '');

          return `
            <div class="screenshot-card">
              <img src="/screenshots/${imgPath}" class="screenshot-img" alt="Screenshot">
              <div class="screenshot-info">
                ${screenshot.analyzed ? `
                  <span class="screenshot-relevance ${relevanceClass}">${relevance}%</span>
                  <p class="screenshot-summary">${screenshot.ai_summary || 'No summary'}</p>
                ` : `
                  <p class="screenshot-summary" style="color: var(--text-secondary);">Not analyzed yet</p>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    modal.classList.add('active');
  } catch (error) {
    console.error('Failed to load session:', error);
    alert('Failed to load session details');
  }
}

async function analyzeSession(sessionName) {
  try {
    await fetch(`${API_BASE}/analyze/${sessionName}`, { method: 'POST' });
    alert('Analysis started! This will take a few minutes. Refresh the page to see results.');
  } catch (error) {
    console.error('Failed to start analysis:', error);
    alert('Failed to start analysis');
  }
}

// ==================== Capture Controls ====================

function initCaptureControls() {
  const captureBtn = document.getElementById('captureBtn');
  const captureModal = document.getElementById('captureModal');
  const captureStartBtn = document.getElementById('captureStartBtn');
  const captureCancelBtn = document.getElementById('captureCancelBtn');

  captureBtn.addEventListener('click', async () => {
    const status = await getCaptureStatus();

    if (status.running) {
      // Stop capture
      if (confirm('Stop current recording?')) {
        await stopCapture();
      }
    } else {
      // Show start modal
      captureModal.classList.add('active');
    }
  });

  captureStartBtn.addEventListener('click', async () => {
    const sessionName = document.getElementById('sessionNameInput').value.trim();
    const description = document.getElementById('sessionDescInput').value.trim();

    if (!sessionName) {
      alert('Please enter a session name');
      return;
    }

    await startCapture(sessionName, description);
    captureModal.classList.remove('active');

    // Clear inputs
    document.getElementById('sessionNameInput').value = '';
    document.getElementById('sessionDescInput').value = '';
  });

  captureCancelBtn.addEventListener('click', () => {
    captureModal.classList.remove('active');
  });
}

async function getCaptureStatus() {
  try {
    const res = await fetch(`${API_BASE}/capture/status`);
    return await res.json();
  } catch (error) {
    return { running: false, session: null };
  }
}

async function checkCaptureStatus() {
  const status = await getCaptureStatus();
  const statusEl = document.getElementById('captureStatus');
  const btnEl = document.getElementById('captureBtn');

  if (status.running) {
    statusEl.querySelector('.status-dot').classList.add('recording');
    statusEl.querySelector('.status-text').textContent = `Recording: ${status.session}`;
    btnEl.textContent = 'Stop Capture';
    btnEl.classList.remove('btn-primary');
    btnEl.classList.add('btn-danger');
  } else {
    statusEl.querySelector('.status-dot').classList.remove('recording');
    statusEl.querySelector('.status-text').textContent = 'Idle';
    btnEl.textContent = 'Start Capture';
    btnEl.classList.add('btn-primary');
    btnEl.classList.remove('btn-danger');
  }
}

async function startCapture(sessionName, description) {
  try {
    await fetch(`${API_BASE}/capture/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionName, description })
    });

    await checkCaptureStatus();
    await loadStats();
  } catch (error) {
    console.error('Failed to start capture:', error);
    alert('Failed to start capture');
  }
}

async function stopCapture() {
  try {
    await fetch(`${API_BASE}/capture/stop`, { method: 'POST' });
    await checkCaptureStatus();
    await loadStats();
    await loadSessions();
  } catch (error) {
    console.error('Failed to stop capture:', error);
    alert('Failed to stop capture');
  }
}

// ==================== Search ====================

function initSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();

  if (!query) {
    alert('Please enter a search query');
    return;
  }

  const resultsEl = document.getElementById('searchResults');
  resultsEl.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">No results found</div>';
      return;
    }

    resultsEl.innerHTML = `
      <div style="margin-bottom: 1rem; color: var(--text-secondary);">
        Found ${results.length} result${results.length === 1 ? '' : 's'}
      </div>
      <div class="screenshot-grid">
        ${results.map(screenshot => {
          const relevance = screenshot.relevance_display || 0;
          const relevanceClass = relevance >= 70 ? 'relevance-high' : relevance >= 40 ? 'relevance-medium' : 'relevance-low';
          const imgPath = screenshot.file_path.replace('/Users/effyzhang/Documents/effyos/screen_story/sessions/', '');

          return `
            <div class="screenshot-card">
              <img src="/screenshots/${imgPath}" class="screenshot-img" alt="Screenshot">
              <div class="screenshot-info">
                <span class="screenshot-relevance ${relevanceClass}">${relevance}%</span>
                <p class="screenshot-summary">${screenshot.ai_summary || 'No summary'}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Search failed:', error);
    resultsEl.innerHTML = '<div class="empty-state">Search failed</div>';
  }
}

// ==================== Export ====================

function initExport() {
  const exportBtn = document.getElementById('exportBtn');

  exportBtn.addEventListener('click', async () => {
    const sessionSelect = document.getElementById('exportSessionSelect');
    const sessionName = sessionSelect.value;
    const heroOnly = document.getElementById('heroOnlyCheckbox').checked;

    if (!sessionName) {
      alert('Please select a session');
      return;
    }

    const outputEl = document.getElementById('exportOutput');
    outputEl.textContent = 'Creating video...';
    outputEl.classList.add('active');
    exportBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/export/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName, heroOnly })
      });

      const result = await res.json();
      outputEl.textContent = result.output || 'Video created successfully!';
    } catch (error) {
      console.error('Export failed:', error);
      outputEl.textContent = 'Export failed: ' + error.message;
    } finally {
      exportBtn.disabled = false;
    }
  });
}

async function loadExportSessions() {
  const select = document.getElementById('exportSessionSelect');

  try {
    const res = await fetch(`${API_BASE}/sessions`);
    const sessions = await res.json();

    select.innerHTML = sessions
      .filter(s => s.analyzed_count > 0)
      .map(s => `<option value="${s.name}">${s.name} (${s.analyzed_count} analyzed)</option>`)
      .join('');

    if (sessions.filter(s => s.analyzed_count > 0).length === 0) {
      select.innerHTML = '<option value="">No analyzed sessions</option>';
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
    select.innerHTML = '<option value="">Failed to load sessions</option>';
  }
}

// ==================== Modals ====================

function initModals() {
  const sessionModal = document.getElementById('sessionModal');
  const captureModal = document.getElementById('captureModal');

  document.getElementById('modalClose').addEventListener('click', () => {
    sessionModal.classList.remove('active');
  });

  document.getElementById('captureModalClose').addEventListener('click', () => {
    captureModal.classList.remove('active');
  });

  // Close on backdrop click
  [sessionModal, captureModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// Make functions globally available
window.viewSession = viewSession;
window.analyzeSession = analyzeSession;
