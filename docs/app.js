// Aruba AOS-CX Automation Portal - Offline & GitHub Enterprise Compatible
document.addEventListener('DOMContentLoaded', () => {
  const MAX_BLOCKS = 10;
  const PRESET_COMMANDS = [
    'show version',
    'show running-config',
    'show vlan',
    'show interface brief',
    'show lldp info remote-device',
    'show mac-address-table',
    'show ip route',
    'show environment'
  ];

  // DOM Elements
  const settingsPanel = document.getElementById('settingsPanel');
  const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsStatusText = document.getElementById('settingsStatusText');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  const apiUrlInput = document.getElementById('apiUrl');
  const repoOwnerInput = document.getElementById('repoOwner');
  const repoNameInput = document.getElementById('repoName');
  const workflowBranchInput = document.getElementById('workflowBranch');
  const githubTokenInput = document.getElementById('githubToken');
  const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
  const clearTokenBtn = document.getElementById('clearTokenBtn');
  const repoLink = document.getElementById('repoLink');

  const actionForm = document.getElementById('actionForm');
  const blocksContainer = document.getElementById('blocksContainer');
  const addBlockBtn = document.getElementById('addBlockBtn');
  const blocksCountBadge = document.getElementById('blocksCountBadge');
  const totalBlocksSummary = document.getElementById('totalBlocksSummary');
  const totalDevicesSummary = document.getElementById('totalDevicesSummary');

  const runnerType = document.getElementById('runnerType');
  const workflowFile = document.getElementById('workflowFile');
  const dispatchBtn = document.getElementById('dispatchBtn');
  const dispatchBtnText = document.getElementById('dispatchBtnText');

  const trackerEmptyState = document.getElementById('trackerEmptyState');
  const trackerActiveState = document.getElementById('trackerActiveState');
  const runTimer = document.getElementById('runTimer');
  const runStatusBadge = document.getElementById('runStatusBadge');
  const runBlocksBadge = document.getElementById('runBlocksBadge');
  const runTargetBadge = document.getElementById('runTargetBadge');
  const runCommandBadge = document.getElementById('runCommandBadge');
  const runIdBadge = document.getElementById('runIdBadge');
  const viewRunLink = document.getElementById('viewRunLink');
  const viewSummaryLink = document.getElementById('viewSummaryLink');
  const toastBox = document.getElementById('toastBox');

  let pollingInterval = null;
  let timerInterval = null;
  let runStartTime = null;

  // Blocks State
  let blocks = [
    {
      id: 'block_1',
      name: 'Block 1',
      devices: '192.168.72.128',
      selectedPresets: ['show version'],
      customCommands: ''
    }
  ];

  function getApiBaseUrl() {
    let raw = apiUrlInput.value.trim() || localStorage.getItem('ansible_gh_api_url') || '';
    if (!raw) {
      if (window.location.hostname && !window.location.hostname.endsWith('github.io') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        raw = `${window.location.protocol}//${window.location.hostname}/api/v3`;
      } else {
        raw = 'https://api.github.com';
      }
    }
    return raw.replace(/\/+$/, '');
  }

  function getWebBaseUrl() {
    const api = getApiBaseUrl();
    if (api.includes('/api/v3')) {
      return api.replace(/\/api\/v3\/?$/, '');
    }
    return 'https://github.com';
  }

  // 1. Settings Setup
  function initConfig() {
    let savedApi = localStorage.getItem('ansible_gh_api_url') || '';
    if (!savedApi) {
      if (window.location.hostname && !window.location.hostname.endsWith('github.io') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        savedApi = `${window.location.protocol}//${window.location.hostname}/api/v3`;
      } else {
        savedApi = 'https://api.github.com';
      }
    }

    let savedOwner = localStorage.getItem('ansible_gh_owner') || '';
    let savedRepo = localStorage.getItem('ansible_gh_repo') || 'ansible';
    let savedBranch = localStorage.getItem('ansible_gh_branch') || 'main';
    let savedToken = localStorage.getItem('ansible_gh_token') || '';

    // Auto-detect GitHub Pages URL pattern: <owner>.github.io/<repo>/
    if (!savedOwner && window.location.hostname.endsWith('.github.io')) {
      savedOwner = window.location.hostname.replace('.github.io', '');
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) savedRepo = pathParts[0];
    }

    apiUrlInput.value = savedApi;
    repoOwnerInput.value = savedOwner;
    repoNameInput.value = savedRepo;
    workflowBranchInput.value = savedBranch;
    githubTokenInput.value = savedToken;

    updateConfigUI(savedOwner, savedRepo, savedToken);

    if (savedOwner && savedRepo && savedToken) {
      settingsPanel.classList.add('hidden');
    } else {
      settingsPanel.classList.remove('hidden');
    }

    renderBlocks();
  }

  function updateConfigUI(owner, repo, token) {
    const webBase = getWebBaseUrl();
    if (owner && repo) {
      repoLink.href = `${webBase}/${owner}/${repo}`;
      if (token) {
        settingsStatusText.textContent = `${owner}/${repo}`;
        settingsStatusText.style.color = '#10b981';
      } else {
        settingsStatusText.textContent = 'Token Required';
        settingsStatusText.style.color = '#f59e0b';
      }
    } else {
      repoLink.href = webBase;
      settingsStatusText.textContent = 'Configure GitHub';
      settingsStatusText.style.color = '';
    }
  }

  toggleSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    const api = getApiBaseUrl();
    const owner = repoOwnerInput.value.trim();
    const repo = repoNameInput.value.trim();
    const branch = workflowBranchInput.value.trim() || 'main';
    const token = githubTokenInput.value.trim();

    localStorage.setItem('ansible_gh_api_url', api);
    localStorage.setItem('ansible_gh_owner', owner);
    localStorage.setItem('ansible_gh_repo', repo);
    localStorage.setItem('ansible_gh_branch', branch);
    localStorage.setItem('ansible_gh_token', token);

    updateConfigUI(owner, repo, token);
    showToast('Settings saved successfully', 'success');
    settingsPanel.classList.add('hidden');
  });

  toggleTokenVisibility.addEventListener('click', () => {
    if (githubTokenInput.type === 'password') {
      githubTokenInput.type = 'text';
      toggleTokenVisibility.textContent = 'Hide';
    } else {
      githubTokenInput.type = 'password';
      toggleTokenVisibility.textContent = 'Show';
    }
  });

  clearTokenBtn.addEventListener('click', () => {
    githubTokenInput.value = '';
    localStorage.removeItem('ansible_gh_token');
    showToast('Token cleared from local storage', 'info');
    updateConfigUI(repoOwnerInput.value.trim(), repoNameInput.value.trim(), '');
  });

  // 2. Helper: Parse Devices
  function parseDevices(raw) {
    if (!raw) return [];
    return raw
      .replace(/[\r\n]+/g, ',')
      .replace(/\s+/g, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 3. Render Blocks UI
  function renderBlocks() {
    blocksContainer.innerHTML = '';

    blocks.forEach((block, index) => {
      const blockIndex = index + 1;
      const parsedDevs = parseDevices(block.devices);
      const customCmdCount = (block.customCommands || '').split('\n').filter(c => c.trim()).length;
      const totalCmdCount = block.selectedPresets.length + customCmdCount;

      const card = document.createElement('div');
      card.className = 'block-card';
      card.id = `card_${block.id}`;

      card.innerHTML = `
        <div class="block-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-tag" style="padding: 2px 6px;">#${blockIndex}</span>
            <input type="text" value="${escapeHtml(block.name)}" 
              data-id="${block.id}" 
              class="block-title-input" 
              placeholder="Block Name">
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="badge-tag" style="color: ${parsedDevs.length > 0 ? '#10b981' : '#94a3b8'};">
              ${parsedDevs.length} ${parsedDevs.length === 1 ? 'dev' : 'devs'}
            </span>
            <span class="badge-tag">
              ${totalCmdCount} ${totalCmdCount === 1 ? 'cmd' : 'cmds'}
            </span>
            ${blocks.length > 1 ? `
            <button type="button" class="btn btn-danger delete-block-btn" data-id="${block.id}">
              Delete
            </button>` : ''}
          </div>
        </div>

        <div class="form-group">
          <label>Target Switches / IP Addresses</label>
          <textarea rows="2" 
            data-id="${block.id}" 
            class="block-devices-input" 
            placeholder="e.g. 192.168.72.128, 192.168.72.129 (or newline separated)">${escapeHtml(block.devices)}</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label>Commands for this Block</label>
          <div class="preset-grid">
            ${PRESET_COMMANDS.map(cmd => {
              const isSelected = block.selectedPresets.includes(cmd);
              return `
                <button type="button" 
                  data-id="${block.id}" 
                  data-cmd="${escapeHtml(cmd)}" 
                  class="preset-chip ${isSelected ? 'active' : ''}">
                  ${isSelected ? '&#10003; ' : ''}${cmd}
                </button>
              `;
            }).join('')}
          </div>

          <input type="text" 
            data-id="${block.id}" 
            value="${escapeHtml(block.customCommands)}"
            placeholder="Additional custom CLI commands (comma separated)" 
            class="block-custom-commands">
        </div>
      `;

      blocksContainer.appendChild(card);
    });

    attachBlockEvents();
    updateGrandTotals();
  }

  function attachBlockEvents() {
    document.querySelectorAll('.block-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = blocks.find(b => b.id === id);
        if (block) block.name = e.target.value;
      });
    });

    document.querySelectorAll('.block-devices-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = blocks.find(b => b.id === id);
        if (block) {
          block.devices = e.target.value;
          updateGrandTotals();
        }
      });
    });

    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cmd = btn.dataset.cmd;
        const block = blocks.find(b => b.id === id);
        if (block) {
          if (block.selectedPresets.includes(cmd)) {
            block.selectedPresets = block.selectedPresets.filter(c => c !== cmd);
          } else {
            block.selectedPresets.push(cmd);
          }
          renderBlocks();
        }
      });
    });

    document.querySelectorAll('.block-custom-commands').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = blocks.find(b => b.id === id);
        if (block) {
          block.customCommands = e.target.value;
          updateGrandTotals();
        }
      });
    });

    document.querySelectorAll('.delete-block-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (blocks.length <= 1) return;
        const id = btn.dataset.id;
        blocks = blocks.filter(b => b.id !== id);
        renderBlocks();
        showToast('Block removed', 'info');
      });
    });
  }

  // 4. Add Block Handler
  addBlockBtn.addEventListener('click', () => {
    if (blocks.length >= MAX_BLOCKS) {
      showToast(`Maximum ${MAX_BLOCKS} blocks reached.`, 'error');
      return;
    }
    const nextNum = blocks.length + 1;
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      name: `Block ${nextNum}`,
      devices: '',
      selectedPresets: ['show version'],
      customCommands: ''
    });
    renderBlocks();
    showToast(`Added Block ${nextNum}`, 'success');
  });

  function updateGrandTotals() {
    let totalDevices = 0;
    blocks.forEach(b => {
      totalDevices += parseDevices(b.devices).length;
    });

    blocksCountBadge.textContent = `${blocks.length} / ${MAX_BLOCKS} Blocks`;
    totalBlocksSummary.textContent = blocks.length;
    totalDevicesSummary.textContent = totalDevices;

    if (blocks.length >= MAX_BLOCKS) {
      addBlockBtn.disabled = true;
      addBlockBtn.textContent = 'Max 10 Blocks';
    } else {
      addBlockBtn.disabled = false;
      addBlockBtn.textContent = '+ Add Block';
    }

    dispatchBtnText.textContent = `🚀 Initiate Action Workflow (${blocks.length} ${blocks.length === 1 ? 'Block' : 'Blocks'})`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // 5. Submit & Action Dispatch
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiBase = getApiBaseUrl();
    const owner = repoOwnerInput.value.trim();
    const repo = repoNameInput.value.trim();
    const branch = workflowBranchInput.value.trim() || 'main';
    const token = githubTokenInput.value.trim();

    if (!owner || !repo) {
      showToast('Please specify the Repository Owner and Name in Settings.', 'error');
      settingsPanel.classList.remove('hidden');
      return;
    }

    if (!token) {
      showToast('GitHub Token is required to dispatch actions.', 'error');
      settingsPanel.classList.remove('hidden');
      return;
    }

    // Validate blocks
    const compiledBlocks = [];
    let totalDeviceCount = 0;
    let totalCommandCount = 0;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const devs = parseDevices(b.devices);
      if (devs.length === 0) {
        showToast(`Please enter switch IPs for ${b.name || 'Block ' + (i + 1)}.`, 'error');
        return;
      }

      const customCmds = (b.customCommands || '')
        .replace(/[\r\n]+/g, ',')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const allCmds = Array.from(new Set([...b.selectedPresets, ...customCmds]));
      if (allCmds.length === 0) {
        showToast(`Please select at least one command for ${b.name || 'Block ' + (i + 1)}.`, 'error');
        return;
      }

      totalDeviceCount += devs.length;
      totalCommandCount += allCmds.length;

      compiledBlocks.push({
        name: b.name || `Block ${i + 1}`,
        devices: devs,
        commands: allCmds
      });
    }

    const runner = runnerType.value;
    const workflow = workflowFile.value.trim();

    dispatchBtn.disabled = true;
    dispatchBtnText.textContent = 'Dispatching to Runner...';

    try {
      const dispatchUrl = `${apiBase}/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
      const response = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: branch,
          inputs: {
            blocks_json: JSON.stringify(compiledBlocks),
            runner_type: runner
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
      }

      showToast(`Action dispatched for ${compiledBlocks.length} block(s)!`, 'success');
      startTrackingRun(apiBase, owner, repo, token, compiledBlocks.length, totalDeviceCount, totalCommandCount);

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      dispatchBtn.disabled = false;
      updateGrandTotals();
    }
  });

  // 6. Tracking & Polling
  function startTrackingRun(apiBase, owner, repo, token, blockCount, devCount, cmdCount) {
    trackerEmptyState.classList.add('hidden');
    trackerActiveState.classList.remove('hidden');

    runBlocksBadge.textContent = `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;
    runTargetBadge.textContent = `${devCount} ${devCount === 1 ? 'Device' : 'Devices'}`;
    runCommandBadge.textContent = `${cmdCount} ${cmdCount === 1 ? 'Command' : 'Commands'}`;

    runStatusBadge.textContent = 'Queued';
    runStatusBadge.style.color = '#f59e0b';
    runIdBadge.textContent = '#detecting...';

    const webBase = getWebBaseUrl();
    viewRunLink.href = `${webBase}/${owner}/${repo}/actions`;
    viewSummaryLink.href = `${webBase}/${owner}/${repo}/actions`;

    if (timerInterval) clearInterval(timerInterval);
    runStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    if (pollingInterval) clearInterval(pollingInterval);

    let attempts = 0;
    const maxAttempts = 80;

    pollingInterval = setInterval(async () => {
      attempts++;
      try {
        const listUrl = `${apiBase}/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=5`;
        const res = await fetch(listUrl, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) return;

        const data = await res.json();
        const runs = data.workflow_runs || [];

        if (runs.length > 0) {
          const latestRun = runs[0];
          runIdBadge.textContent = `#${latestRun.id}`;
          viewRunLink.href = latestRun.html_url;
          viewSummaryLink.href = `${latestRun.html_url}#summary`;

          if (latestRun.status === 'in_progress') {
            runStatusBadge.textContent = 'In Progress...';
            runStatusBadge.style.color = '#38bdf8';
          } else if (latestRun.status === 'completed') {
            clearInterval(pollingInterval);
            clearInterval(timerInterval);

            if (latestRun.conclusion === 'success') {
              runStatusBadge.textContent = 'Success ✅';
              runStatusBadge.style.color = '#10b981';
              showToast('Ansible execution completed successfully!', 'success');
            } else {
              runStatusBadge.textContent = `Completed (${latestRun.conclusion}) ⚠️`;
              runStatusBadge.style.color = '#f59e0b';
              showToast('Execution finished. Check summary for details.', 'info');
            }
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollingInterval);
          clearInterval(timerInterval);
        }

      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }

  function updateTimer() {
    if (!runStartTime) return;
    const elapsedSeconds = Math.floor((Date.now() - runStartTime) / 1000);
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    runTimer.textContent = `${mins}:${secs}`;
  }

  // 7. Toast
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Initialize
  initConfig();
});
