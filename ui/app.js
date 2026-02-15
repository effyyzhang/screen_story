// API base URL
const API_BASE = 'http://localhost:3000/api';

// ==================== State Management ====================
const state = {
  currentFolder: 'all',
  currentView: 'grid',
  currentPage: 1,
  totalPages: 1,
  selectedScreenshots: new Set(),
  screenshots: [],
  folderCounts: {},
  activeScreenshot: null,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  searchQuery: '',
  // Advanced filters
  filters: {
    textSearch: '',
    dateStart: null,
    dateEnd: null,
    apps: []
  },
  filterPanelCollapsed: false,
  availableApps: []
};

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
  // Sync init functions (fast, < 10ms total)
  initFolders();
  initViewToggle();
  initPagination();
  initPropertiesPanel();
  initBulkOperations();
  initSearch();
  initCaptureControls();
  initModals();
  initFilterPanel();

  // Parallel data loading (removes sequential waterfall)
  Promise.all([
    loadFolderCounts(),   // Already loads apps internally
    checkCaptureStatus()  // Can run in parallel
  ]).then(() => {
    // These depend on folder data being loaded
    loadFiltersFromURL();
    loadScreenshots();
  });

  // Poll capture status every 5 seconds
  setInterval(checkCaptureStatus, 5000);
});

// ==================== Folder Navigation ====================
async function initFolders() {
  // Folder click handlers
  document.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      const folder = item.dataset.folder;
      selectFolder(folder);
    });
  });

  await loadFolderCounts();
}

async function loadFolderCounts() {
  try {
    // NEW: Single API call for all folder counts (4 calls → 1)
    const data = await fetch(`${API_BASE}/folders/all`).then(r => r.json());

    renderAppFolders(data.apps);
    renderSessionFolders(data.sessions);
    updateTimePeriodCounts(data.timePeriods);
    updateSuccessCounts(data.success);
    document.getElementById('allCount').textContent = data.total;

    // Store apps for filter panel
    state.availableApps = data.apps || [];
    renderAppCheckboxList();
  } catch (error) {
    console.error('Failed to load folder counts:', error);

    // FALLBACK: Use existing endpoints if new one fails
    const [apps, sessions, timePeriods, success] = await Promise.all([
      fetch(`${API_BASE}/folders/apps`).then(r => r.json()),
      fetch(`${API_BASE}/folders/sessions`).then(r => r.json()),
      fetch(`${API_BASE}/folders/time-periods`).then(r => r.json()),
      fetch(`${API_BASE}/folders/success`).then(r => r.json())
    ]);

    renderAppFolders(apps.apps);
    renderSessionFolders(sessions.sessions);
    updateTimePeriodCounts(timePeriods);
    updateSuccessCounts(success);

    const totalCount = apps.apps.reduce((sum, app) => sum + app.count, 0);
    document.getElementById('allCount').textContent = totalCount;

    state.availableApps = apps.apps || [];
    renderAppCheckboxList();
  }
}

function renderAppFolders(apps) {
  const container = document.getElementById('appFolders');

  if (apps.length === 0) {
    container.innerHTML = '<div class="folder-loading">No apps yet</div>';
    return;
  }

  container.innerHTML = apps.map(app => `
    <div class="folder-item" data-folder="app:${app.name}">
      <span class="folder-icon">💻</span>
      <span class="folder-label">${app.name}</span>
      <span class="folder-count">${app.count}</span>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      const folder = item.dataset.folder;
      selectFolder(folder);
    });
  });
}

function renderSessionFolders(sessions) {
  const container = document.getElementById('sessionFolders');

  if (sessions.length === 0) {
    container.innerHTML = '<div class="folder-loading">No sessions yet</div>';
    return;
  }

  container.innerHTML = sessions.map(session => `
    <div class="folder-item" data-folder="session:${session.name}">
      <span class="folder-icon">📂</span>
      <span class="folder-label">${session.name}</span>
      <span class="folder-count">${session.count}</span>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      const folder = item.dataset.folder;
      selectFolder(folder);
    });
  });
}

function updateTimePeriodCounts(counts) {
  document.getElementById('todayCount').textContent = counts.today || 0;
  document.getElementById('yesterdayCount').textContent = counts.yesterday || 0;
  document.getElementById('weekCount').textContent = counts.week || 0;
  document.getElementById('monthCount').textContent = counts.month || 0;
}

function updateSuccessCounts(counts) {
  document.getElementById('heroCount').textContent = counts.hero || 0;
  document.getElementById('successCount').textContent = counts.success || 0;
}

function selectFolder(folder) {
  state.currentFolder = folder;
  state.currentPage = 1;
  state.selectedScreenshots.clear();

  // Clear filters when leaving "All Screenshots"
  if (folder !== 'all') {
    clearAllFilters();
  }

  // Update UI
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folder);
  });

  // Update breadcrumb
  updateBreadcrumb(folder);

  // Update filter panel visibility
  updateFilterPanelVisibility();

  // Load screenshots
  loadScreenshots();
}

function updateBreadcrumb(folder) {
  const breadcrumb = document.getElementById('breadcrumb');
  const labels = {
    'all': 'All Screenshots',
    'success:hero': 'Hero Moments',
    'success:success': 'Success',
    'time:today': 'Today',
    'time:yesterday': 'Yesterday',
    'time:week': 'Last 7 days',
    'time:month': 'Last 30 days'
  };

  if (folder.startsWith('app:')) {
    breadcrumb.textContent = folder.replace('app:', '');
  } else if (folder.startsWith('session:')) {
    breadcrumb.textContent = folder.replace('session:', '');
  } else {
    breadcrumb.textContent = labels[folder] || 'Screenshots';
  }
}

// ==================== View Toggle ====================
function initViewToggle() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Sort dropdown
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    const [sortBy, sortOrder] = e.target.value.split('-');
    state.sortBy = sortBy;
    state.sortOrder = sortOrder;
    loadScreenshots();
  });

  // Select all checkbox
  document.getElementById('selectAll').addEventListener('change', (e) => {
    if (e.target.checked) {
      state.screenshots.forEach(s => state.selectedScreenshots.add(s.id));
    } else {
      state.selectedScreenshots.clear();
    }
    updateBulkBar();
    renderScreenshots();
  });
}

function switchView(view) {
  state.currentView = view;

  // Update buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Toggle views
  document.getElementById('gridView').hidden = view !== 'grid';
  document.getElementById('listView').hidden = view !== 'list';
}

// ==================== Load Screenshots ====================
async function loadScreenshots() {
  const { currentFolder, currentPage, sortBy, sortOrder } = state;

  showLoading();

  try {
    const params = buildFilterParams();

    const res = await fetch(`${API_BASE}/screenshots?${params}`);
    const data = await res.json();

    state.screenshots = data.screenshots;
    state.totalPages = data.pages;

    renderScreenshots();
    updatePagination();
    updateActiveFiltersBar(data.total);
  } catch (error) {
    console.error('Failed to load screenshots:', error);
    showEmpty();
  }
}

function renderScreenshots() {
  if (state.screenshots.length === 0) {
    showEmpty();
    return;
  }

  hideLoading();
  hideEmpty();

  if (state.currentView === 'grid') {
    renderGridView();
  } else {
    renderListView();
  }
}

function renderGridView() {
  const container = document.getElementById('gridView');
  container.innerHTML = state.screenshots.map(screenshot => {
    const relevance = screenshot.relevance_display || 0;
    const relevanceClass = relevance >= 70 ? 'relevance-high' : relevance >= 40 ? 'relevance-medium' : 'relevance-low';
    const imgPath = screenshot.file_path.replace(/^.*\/sessions\//, '');
    const isSelected = state.selectedScreenshots.has(screenshot.id);

    // Parse session and filename for thumbnail URLs
    const pathParts = imgPath.split('/');
    const session = pathParts[0];
    const filename = pathParts[1];

    // Request thumbnails with responsive images
    const thumbUrl = `/screenshots/${session}/${filename}?size=thumb`;
    const mediumUrl = `/screenshots/${session}/${filename}?size=medium`;

    // Window info badge
    let windowBadge = '';
    if (screenshot.window_info) {
      windowBadge = screenshot.window_info.isFullscreen
        ? '<span class="badge badge-fullscreen">⛶ Fullscreen</span>'
        : `<span class="badge badge-windowed">🪟 ${screenshot.window_info.dimensions}</span>`;
    }

    return `
      <div class="screenshot-card ${isSelected ? 'selected' : ''}" data-id="${screenshot.id}" onclick="selectScreenshot(${screenshot.id}, event)">
        <img src="${thumbUrl}"
             srcset="${thumbUrl} 400w, ${mediumUrl} 800w"
             sizes="(max-width: 600px) 400px, 800px"
             class="screenshot-img"
             alt="Screenshot"
             loading="lazy">
        <div class="screenshot-info">
          ${windowBadge}
          ${screenshot.analyzed ? `
            <span class="screenshot-relevance ${relevanceClass}">${relevance}%</span>
            <p class="screenshot-summary">${screenshot.ai_summary || 'No summary'}</p>
          ` : `
            <p class="screenshot-summary">Not analyzed yet</p>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderListView() {
  const tbody = document.getElementById('listViewBody');
  tbody.innerHTML = state.screenshots.map(screenshot => {
    const relevance = screenshot.relevance_display || 0;
    const relevanceClass = relevance >= 70 ? 'relevance-high' : relevance >= 40 ? 'relevance-medium' : 'relevance-low';
    const imgPath = screenshot.file_path.replace(/^.*\/sessions\//, '');
    const time = new Date(screenshot.timestamp).toLocaleTimeString();
    const isSelected = state.selectedScreenshots.has(screenshot.id);

    // Parse session and filename for thumbnail URL
    const pathParts = imgPath.split('/');
    const session = pathParts[0];
    const filename = pathParts[1];

    // Request thumbnail
    const thumbUrl = `/screenshots/${session}/${filename}?size=thumb`;

    return `
      <tr class="${isSelected ? 'selected' : ''}" onclick="selectScreenshot(${screenshot.id}, event)">
        <td><input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''} onclick="toggleSelection(${screenshot.id}, event)"></td>
        <td><img src="${thumbUrl}" class="table-thumbnail" alt="Screenshot" loading="lazy"></td>
        <td>${screenshot.ai_summary || 'No summary'}</td>
        <td>${screenshot.app_name || '-'}</td>
        <td>${time}</td>
        <td><span class="screenshot-relevance ${relevanceClass}">${relevance}%</span></td>
      </tr>
    `;
  }).join('');
}

// ==================== Properties Panel ====================
function initPropertiesPanel() {
  // Edit tags button
  document.getElementById('editTagsBtn').addEventListener('click', () => {
    if (state.activeScreenshot) {
      openTagModal(state.activeScreenshot);
    }
  });

  // Action buttons
  document.getElementById('openInFinderBtn').addEventListener('click', () => {
    if (state.activeScreenshot) {
      alert(`Open in Finder: ${state.activeScreenshot.file_path}`);
    }
  });

  document.getElementById('copyImageBtn').addEventListener('click', () => {
    if (state.activeScreenshot) {
      alert('Image copy functionality would be implemented here');
    }
  });

  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (state.activeScreenshot && confirm('Delete this screenshot?')) {
      await deleteScreenshots([state.activeScreenshot.id]);
      state.activeScreenshot = null;
      renderPropertiesPanel();
      loadScreenshots();
      loadFolderCounts();
    }
  });
}

function selectScreenshot(id, event) {
  // Don't select if clicking checkbox
  if (event && event.target.type === 'checkbox') return;

  // If Cmd/Ctrl key held, toggle multi-selection
  if (event && (event.metaKey || event.ctrlKey)) {
    toggleSelection(id, event);
    return;
  }

  state.activeScreenshot = state.screenshots.find(s => s.id === id);
  renderPropertiesPanel();
}

function renderPropertiesPanel() {
  const screenshot = state.activeScreenshot;

  if (!screenshot) {
    document.getElementById('noSelection').hidden = false;
    document.getElementById('screenshotDetails').hidden = true;
    return;
  }

  document.getElementById('noSelection').hidden = true;
  document.getElementById('screenshotDetails').hidden = false;

  // Update all detail fields
  const imgPath = screenshot.file_path.replace(/^.*\/sessions\//, '');
  document.getElementById('detailPreview').src = `/screenshots/${imgPath}`;
  document.getElementById('detailSession').textContent = screenshot.session_name || '-';
  document.getElementById('detailApp').textContent = screenshot.app_name || '-';
  document.getElementById('detailWindow').textContent = screenshot.window_title || '-';
  document.getElementById('detailTime').textContent = new Date(screenshot.timestamp).toLocaleString();
  document.getElementById('detailFrame').textContent = `#${screenshot.frame_number || 1}`;
  document.getElementById('detailSummary').textContent = screenshot.ai_summary || 'No summary available';
  document.getElementById('detailOCR').textContent = screenshot.ocr_text || 'No OCR text available';

  const relevance = screenshot.relevance_display || 0;
  const relevanceClass = relevance >= 70 ? 'relevance-high' : relevance >= 40 ? 'relevance-medium' : 'relevance-low';
  document.getElementById('detailRelevance').textContent = `${relevance}%`;
  document.getElementById('detailRelevance').className = `relevance-badge ${relevanceClass}`;

  // Show/hide success indicator
  document.getElementById('detailSuccessRow').hidden = !screenshot.is_success;

  // Render tags
  renderTags(screenshot.tags);
}

function renderTags(tagsJson) {
  const container = document.getElementById('detailTags');

  let tags = [];
  try {
    tags = tagsJson ? JSON.parse(tagsJson) : [];
  } catch (e) {
    tags = [];
  }

  if (tags.length === 0) {
    container.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">No tags</div>';
    return;
  }

  container.innerHTML = tags.map(tag => `<span class="tag-chip">${tag}</span>`).join('');
}

// ==================== Bulk Operations ====================
function initBulkOperations() {
  document.getElementById('bulkTagBtn').addEventListener('click', () => {
    if (state.selectedScreenshots.size > 0) {
      openTagModal(null, Array.from(state.selectedScreenshots));
    }
  });

  document.getElementById('bulkDeleteBtn').addEventListener('click', async () => {
    const count = state.selectedScreenshots.size;
    if (count > 0 && confirm(`Delete ${count} screenshot(s)?`)) {
      await deleteScreenshots(Array.from(state.selectedScreenshots));
      state.selectedScreenshots.clear();
      updateBulkBar();
      loadScreenshots();
      loadFolderCounts();
    }
  });

  document.getElementById('bulkClearBtn').addEventListener('click', () => {
    state.selectedScreenshots.clear();
    updateBulkBar();
    renderScreenshots();
  });

  document.getElementById('bulkExportBtn').addEventListener('click', () => {
    alert('Export functionality would be implemented here');
  });
}

function toggleSelection(id, event) {
  event.stopPropagation();

  if (state.selectedScreenshots.has(id)) {
    state.selectedScreenshots.delete(id);
  } else {
    state.selectedScreenshots.add(id);
  }

  updateBulkBar();
  renderScreenshots();
}

function updateBulkBar() {
  const count = state.selectedScreenshots.size;
  const bulkBar = document.getElementById('bulkBar');

  if (count > 0) {
    bulkBar.hidden = false;
    document.getElementById('selectedCount').textContent = count;
  } else {
    bulkBar.hidden = true;
  }
}

async function deleteScreenshots(ids) {
  try {
    await fetch(`${API_BASE}/screenshots/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
  } catch (error) {
    console.error('Failed to delete screenshots:', error);
    alert('Failed to delete screenshots');
  }
}

// ==================== Tag Management ====================
function openTagModal(screenshot, bulkIds) {
  const modal = document.getElementById('tagModal');
  const input = document.getElementById('tagInput');

  // Load existing tags if editing single screenshot
  if (screenshot) {
    try {
      const tags = screenshot.tags ? JSON.parse(screenshot.tags) : [];
      input.value = tags.join(', ');
    } catch (e) {
      input.value = '';
    }
  } else {
    input.value = '';
  }

  modal.classList.add('active');
  input.focus();

  // Save handler
  const saveHandler = async () => {
    const tagsText = input.value.trim();
    const tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(t => t) : [];

    if (screenshot) {
      // Update single screenshot
      await updateScreenshotTags(screenshot.id, tags);
    } else if (bulkIds) {
      // Bulk update
      await bulkUpdateTags(bulkIds, tags);
    }

    modal.classList.remove('active');
    state.selectedScreenshots.clear();
    updateBulkBar();
    loadScreenshots();
    if (screenshot) {
      renderPropertiesPanel();
    }
  };

  document.getElementById('tagSaveBtn').onclick = saveHandler;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') saveHandler();
  };
}

async function updateScreenshotTags(id, tags) {
  try {
    await fetch(`${API_BASE}/screenshots/${id}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    });
  } catch (error) {
    console.error('Failed to update tags:', error);
    alert('Failed to update tags');
  }
}

async function bulkUpdateTags(ids, tags) {
  try {
    await fetch(`${API_BASE}/screenshots/bulk-tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, tags })
    });
  } catch (error) {
    console.error('Failed to update tags:', error);
    alert('Failed to update tags');
  }
}

// ==================== Pagination ====================
function initPagination() {
  document.getElementById('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      loadScreenshots();
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage++;
      loadScreenshots();
    }
  });
}

function updatePagination() {
  document.getElementById('currentPage').textContent = state.currentPage;
  document.getElementById('totalPages').textContent = state.totalPages;
  document.getElementById('prevPage').disabled = state.currentPage === 1;
  document.getElementById('nextPage').disabled = state.currentPage === state.totalPages;
}

// ==================== Search ====================
function initSearch() {
  const searchInput = document.getElementById('quickSearch');
  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      state.currentPage = 1;
      loadScreenshots();
    }, 300); // Debounce 300ms
  });
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
      if (confirm('Stop current recording?')) {
        await stopCapture();
      }
    } else {
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
    await loadFolderCounts();
  } catch (error) {
    console.error('Failed to start capture:', error);
    alert('Failed to start capture');
  }
}

async function stopCapture() {
  try {
    await fetch(`${API_BASE}/capture/stop`, { method: 'POST' });
    await checkCaptureStatus();
    await loadFolderCounts();
  } catch (error) {
    console.error('Failed to stop capture:', error);
    alert('Failed to stop capture');
  }
}

// ==================== Modals ====================
function initModals() {
  const tagModal = document.getElementById('tagModal');
  const captureModal = document.getElementById('captureModal');
  const settingsModal = document.getElementById('settingsModal');

  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', async () => {
    settingsModal.classList.add('active');

    // Load current folder if running in Electron
    if (window.electron && window.electron.isElectron) {
      const currentFolder = await window.electron.getScreenshotFolder();
      document.getElementById('screenshotFolderInput').value = currentFolder;
    }
  });

  document.getElementById('settingsModalClose').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  document.getElementById('settingsCloseBtn').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  // Folder selection
  document.getElementById('selectFolderBtn').addEventListener('click', async () => {
    if (window.electron && window.electron.isElectron) {
      const result = await window.electron.selectScreenshotFolder();
      if (result.success && result.path) {
        document.getElementById('screenshotFolderInput').value = result.path;
      }
    } else {
      alert('Folder selection is only available in the Electron app');
    }
  });

  document.getElementById('tagModalClose').addEventListener('click', () => {
    tagModal.classList.remove('active');
  });

  document.getElementById('captureModalClose').addEventListener('click', () => {
    captureModal.classList.remove('active');
  });

  document.getElementById('tagCancelBtn').addEventListener('click', () => {
    tagModal.classList.remove('active');
  });

  // Video assembly modal
  const videoModal = document.getElementById('videoModal');

  document.getElementById('videoBtn').addEventListener('click', async () => {
    videoModal.classList.add('active');

    // Load sessions
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      const select = document.getElementById('videoSessionSelect');

      if (data.sessions && data.sessions.length > 0) {
        select.innerHTML = data.sessions.map(s =>
          `<option value="${s.session_name}">${s.session_name} (${s.total_screenshots} frames)</option>`
        ).join('');
      } else {
        select.innerHTML = '<option value="">No sessions available</option>';
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      document.getElementById('videoSessionSelect').innerHTML = '<option value="">Error loading sessions</option>';
    }
  });

  document.getElementById('videoModalClose').addEventListener('click', () => {
    videoModal.classList.remove('active');
  });

  document.getElementById('videoCancelBtn').addEventListener('click', () => {
    videoModal.classList.remove('active');
  });

  document.getElementById('videoCreateBtn').addEventListener('click', async () => {
    const sessionName = document.getElementById('videoSessionSelect').value;
    const mode = document.getElementById('videoModeSelect').value;
    const autoCrop = document.getElementById('videoAutoCropCheck').checked;
    const format = document.getElementById('videoFormatSelect').value;

    if (!sessionName) {
      alert('Please select a session');
      return;
    }

    // Show progress
    document.getElementById('videoProgress').hidden = false;
    document.getElementById('videoProgressText').textContent = 'Starting...';
    document.getElementById('videoProgressBar').style.width = '10%';
    document.getElementById('videoCreateBtn').disabled = true;

    try {
      const response = await fetch(`${API_BASE}/video/assemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName, mode, autoCrop, format })
      });

      const result = await response.json();

      if (result.success) {
        document.getElementById('videoProgressBar').style.width = '100%';
        alert(`Video created successfully!\n\nPath: ${result.outputPath}\n\n${result.stats ? `Stats:\n- ${result.stats.frameCount} frames\n- ${result.stats.totalDuration}s duration\n- ${result.stats.croppedCount} cropped\n- Avg relevance: ${result.stats.avgRelevance}%` : ''}`);
        videoModal.classList.remove('active');
      } else {
        alert(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Video assembly error:', error);
      alert(`Failed to create video: ${error.message}`);
    } finally {
      document.getElementById('videoProgress').hidden = true;
      document.getElementById('videoProgressBar').style.width = '0%';
      document.getElementById('videoCreateBtn').disabled = false;
    }
  });

  // Close on backdrop click
  [tagModal, captureModal, settingsModal, videoModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// ==================== Helper Functions ====================
function showLoading() {
  document.getElementById('loadingState').hidden = false;
  document.getElementById('gridView').hidden = true;
  document.getElementById('listView').hidden = true;
  document.getElementById('emptyState').hidden = true;
}

function hideLoading() {
  document.getElementById('loadingState').hidden = true;
}

function showEmpty() {
  document.getElementById('emptyState').hidden = false;
  document.getElementById('gridView').hidden = true;
  document.getElementById('listView').hidden = true;
  hideLoading();
}

function hideEmpty() {
  document.getElementById('emptyState').hidden = true;
}

// ==================== Advanced Filter Panel ====================
function initFilterPanel() {
  // Toggle filter panel collapse
  document.getElementById('toggleFilterPanel').addEventListener('click', toggleFilterPanelCollapse);
  document.querySelector('.filter-header').addEventListener('click', (e) => {
    if (e.target.closest('.filter-header-actions')) return;
    toggleFilterPanelCollapse();
  });

  // General search with debounce
  let searchDebounce;
  document.getElementById('generalSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.filters.textSearch = e.target.value.trim();
      applyFilters();
    }, 300);
  });

  // Date inputs
  document.getElementById('dateStartInput').addEventListener('change', (e) => {
    state.filters.dateStart = e.target.value;
  });

  document.getElementById('dateEndInput').addEventListener('change', (e) => {
    state.filters.dateEnd = e.target.value;
  });

  // Quick date buttons
  document.querySelectorAll('.btn-quick-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      setQuickDateRange(range);

      // Update active state
      document.querySelectorAll('.btn-quick-date').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // App search filter
  let appSearchDebounce;
  document.getElementById('appSearchInput').addEventListener('input', (e) => {
    clearTimeout(appSearchDebounce);
    appSearchDebounce = setTimeout(() => {
      renderAppCheckboxList(e.target.value.toLowerCase());
    }, 200);
  });

  // Apply and clear buttons
  document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
  document.getElementById('clearAllFiltersBtn').addEventListener('click', clearAllFilters);

  // Initialize filter panel visibility
  updateFilterPanelVisibility();
}

async function loadAvailableApps() {
  try {
    const res = await fetch(`${API_BASE}/folders/apps`);
    const data = await res.json();
    state.availableApps = data.apps || [];
    renderAppCheckboxList();
  } catch (error) {
    console.error('Failed to load apps:', error);
  }
}

function renderAppCheckboxList(searchTerm = '') {
  const container = document.getElementById('appCheckboxList');

  const filteredApps = state.availableApps.filter(app =>
    app.name.toLowerCase().includes(searchTerm)
  );

  if (filteredApps.length === 0) {
    container.innerHTML = '<div class="app-checkbox-item" style="color: var(--text-secondary);">No apps found</div>';
    return;
  }

  container.innerHTML = filteredApps.map(app => `
    <div class="app-checkbox-item">
      <input
        type="checkbox"
        id="app-${app.name}"
        value="${app.name}"
        ${state.filters.apps.includes(app.name) ? 'checked' : ''}
        onchange="toggleAppFilter('${app.name}')"
      >
      <label for="app-${app.name}">${app.name}</label>
      <span class="app-checkbox-count">${app.count}</span>
    </div>
  `).join('');
}

function toggleAppFilter(appName) {
  const index = state.filters.apps.indexOf(appName);
  if (index > -1) {
    state.filters.apps.splice(index, 1);
  } else {
    state.filters.apps.push(appName);
  }
}

function setQuickDateRange(range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let startDate, endDate;

  if (range === 'today') {
    startDate = today;
    endDate = today;
  } else if (range === 'yesterday') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 1);
    endDate = startDate;
  } else if (range === 'week') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);
    endDate = today;
  } else if (range === 'month') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    endDate = today;
  }

  // Format dates as YYYY-MM-DD
  state.filters.dateStart = formatDateForInput(startDate);
  state.filters.dateEnd = formatDateForInput(endDate);

  // Update UI inputs
  document.getElementById('dateStartInput').value = state.filters.dateStart;
  document.getElementById('dateEndInput').value = state.filters.dateEnd;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function applyFilters() {
  // Validate date range
  if (state.filters.dateStart && state.filters.dateEnd) {
    if (new Date(state.filters.dateStart) > new Date(state.filters.dateEnd)) {
      alert('Start date must be before or equal to end date');
      return;
    }
  }

  // Reset to page 1 when applying filters
  state.currentPage = 1;

  // Sync URL with filters
  syncURLWithFilters();

  // Reload screenshots
  loadScreenshots();
}

function clearAllFilters() {
  // Reset filter state
  state.filters = {
    textSearch: '',
    dateStart: null,
    dateEnd: null,
    apps: []
  };

  // Clear UI inputs
  document.getElementById('generalSearchInput').value = '';
  document.getElementById('dateStartInput').value = '';
  document.getElementById('dateEndInput').value = '';
  document.getElementById('appSearchInput').value = '';
  document.querySelectorAll('.btn-quick-date').forEach(btn => btn.classList.remove('active'));

  // Uncheck all apps
  renderAppCheckboxList();

  // Reload screenshots
  state.currentPage = 1;
  syncURLWithFilters();
  loadScreenshots();
}

function buildFilterParams() {
  const { currentFolder, currentPage, sortBy, sortOrder, filters } = state;

  const params = new URLSearchParams({
    page: currentPage,
    limit: 50,
    folder: currentFolder,
    sort: `${sortBy}-${sortOrder}`
  });

  // Only apply advanced filters on "All Screenshots"
  if (currentFolder === 'all') {
    if (filters.textSearch) {
      params.append('q', filters.textSearch);
    }
    if (filters.dateStart) {
      params.append('dateStart', filters.dateStart);
    }
    if (filters.dateEnd) {
      params.append('dateEnd', filters.dateEnd);
    }
    if (filters.apps.length > 0) {
      params.append('apps', filters.apps.join(','));
    }
  }

  return params;
}

function syncURLWithFilters() {
  const params = buildFilterParams();
  const newURL = `${window.location.pathname}?${params}`;
  window.history.replaceState({}, '', newURL);
}

function loadFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);

  // Only load filters if we're on "All Screenshots"
  if (params.get('folder') === 'all' || !params.get('folder')) {
    if (params.get('q')) {
      state.filters.textSearch = params.get('q');
      document.getElementById('generalSearchInput').value = state.filters.textSearch;
    }
    if (params.get('dateStart')) {
      state.filters.dateStart = params.get('dateStart');
      document.getElementById('dateStartInput').value = state.filters.dateStart;
    }
    if (params.get('dateEnd')) {
      state.filters.dateEnd = params.get('dateEnd');
      document.getElementById('dateEndInput').value = state.filters.dateEnd;
    }
    if (params.get('apps')) {
      state.filters.apps = params.get('apps').split(',').filter(a => a);
    }
  }
}

function updateActiveFiltersBar(totalResults = 0) {
  const bar = document.getElementById('activeFiltersBar');
  const chipsContainer = document.getElementById('filterChips');
  const countSpan = document.getElementById('activeFilterCount');
  const resultsSpan = document.getElementById('filteredResultCount');

  const activeFilters = [];

  // Count active filters
  if (state.filters.textSearch) activeFilters.push({ type: 'text', label: 'Search', value: state.filters.textSearch });
  if (state.filters.dateStart || state.filters.dateEnd) {
    const dateLabel = state.filters.dateStart && state.filters.dateEnd
      ? `${state.filters.dateStart} to ${state.filters.dateEnd}`
      : state.filters.dateStart || state.filters.dateEnd;
    activeFilters.push({ type: 'date', label: 'Date', value: dateLabel });
  }
  if (state.filters.apps.length > 0) {
    activeFilters.push({ type: 'apps', label: 'Apps', value: state.filters.apps.join(', ') });
  }

  // Show/hide bar
  if (activeFilters.length === 0 || state.currentFolder !== 'all') {
    bar.hidden = true;
    return;
  }

  bar.hidden = false;
  countSpan.textContent = activeFilters.length;
  resultsSpan.textContent = totalResults;

  // Render filter chips
  chipsContainer.innerHTML = activeFilters.map(filter => `
    <div class="filter-chip">
      <span class="filter-chip-label">${filter.label}:</span>
      ${filter.value}
      <button class="filter-chip-remove" onclick="removeFilterChip('${filter.type}')" title="Remove filter">×</button>
    </div>
  `).join('');
}

function removeFilterChip(type) {
  if (type === 'text') {
    state.filters.textSearch = '';
    document.getElementById('generalSearchInput').value = '';
  } else if (type === 'date') {
    state.filters.dateStart = null;
    state.filters.dateEnd = null;
    document.getElementById('dateStartInput').value = '';
    document.getElementById('dateEndInput').value = '';
    document.querySelectorAll('.btn-quick-date').forEach(btn => btn.classList.remove('active'));
  } else if (type === 'apps') {
    state.filters.apps = [];
    renderAppCheckboxList();
  }

  applyFilters();
}

function updateFilterPanelVisibility() {
  const panel = document.getElementById('filterPanel');

  // Show filter panel only on "All Screenshots"
  if (state.currentFolder === 'all') {
    panel.hidden = false;
  } else {
    panel.hidden = true;
  }
}

function toggleFilterPanelCollapse() {
  state.filterPanelCollapsed = !state.filterPanelCollapsed;
  const panel = document.getElementById('filterPanel');
  panel.classList.toggle('collapsed', state.filterPanelCollapsed);
}

// ==================== Make Functions Globally Available ====================
window.selectScreenshot = selectScreenshot;
window.toggleSelection = toggleSelection;
window.toggleAppFilter = toggleAppFilter;
window.removeFilterChip = removeFilterChip;
