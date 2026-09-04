// Aruba AOS-CX Automation Portal - Dynamic Schema-Driven Playbook Engine
document.addEventListener('DOMContentLoaded', () => {
  const MAX_BLOCKS = 10;

  // DOM Elements - Settings
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

  // DOM Elements - Playbook Selector
  const playbookGrid = document.getElementById('playbookGrid');
  const playbookCountBadge = document.getElementById('playbookCountBadge');
  const selectedPlaybookIcon = document.getElementById('selectedPlaybookIcon');
  const selectedPlaybookTitle = document.getElementById('selectedPlaybookTitle');
  const selectedPlaybookBadge = document.getElementById('selectedPlaybookBadge');
  const selectedPlaybookDesc = document.getElementById('selectedPlaybookDesc');
  const multiBlockControls = document.getElementById('multiBlockControls');
  const addBlockBtn = document.getElementById('addBlockBtn');
  const statsBar = document.getElementById('statsBar');
  const totalBlocksSummary = document.getElementById('totalBlocksSummary');
  const totalDevicesSummary = document.getElementById('totalDevicesSummary');
  const dynamicInputsContainer = document.getElementById('dynamicInputsContainer');

  // DOM Elements - Form & Action
  const actionForm = document.getElementById('actionForm');
  const runnerType = document.getElementById('runnerType');
  const workflowFile = document.getElementById('workflowFile');
  const dispatchBtn = document.getElementById('dispatchBtn');
  const dispatchBtnText = document.getElementById('dispatchBtnText');

  // DOM Elements - Tracker
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

  // Active State
  let activePlaybookId = 'aoscx_run_command';
  let multiBlocks = [
    {
      id: 'block_1',
      name: 'Block 1',
      devices: '192.168.72.128',
      selectedPresets: ['show version'],
      customCommands: ''
    }
  ];

  // Store form field values for field-based playbooks
  let dynamicFieldValues = {};

  // 1. API & Server URL Helpers
  function getApiBaseUrl() {
    let raw = apiUrlInput.value.trim() || localStorage.getItem('ansible_gh_api_url') || '';
    if (!raw) {
      if (window.location.hostname && !window.location.hostname.endsWith('github.io') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        raw = `${window.location.protocol}//${window.location.hostname}/api/v3`;
      } else {
        raw = 'https://api.github.com';
      }
    }
    raw = raw.replace(/\/+$/, '');
    // If corporate GHE URL without /api/v3, auto-append
    if (!raw.includes('api.github.com') && !raw.includes('/api/v3')) {
      raw = `${raw}/api/v3`;
    }
    return raw;
  }

  function getWebBaseUrl() {
    const api = getApiBaseUrl();
    if (api.includes('/api/v3')) {
      return api.replace(/\/api\/v3\/?$/, '');
    }
    return 'https://github.com';
  }

  // 2. Settings Management
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

  // 3. Playbook Catalog Engine
  function getCatalog() {
    return window.PLAYBOOK_CATALOG || {};
  }

  function getActivePlaybook() {
    const catalog = getCatalog();
    return catalog[activePlaybookId] || Object.values(catalog)[0];
  }

  function renderPlaybookSelector() {
    const catalog = getCatalog();
    const entries = Object.values(catalog);

    playbookCountBadge.textContent = `${entries.length} Playbooks Available`;
    playbookGrid.innerHTML = '';

    entries.forEach(playbook => {
      const isSelected = playbook.id === activePlaybookId;
      const card = document.createElement('div');
      card.className = `playbook-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = playbook.id;

      card.innerHTML = `
        <div>
          <div class="playbook-card-top">
            <span class="playbook-card-icon">${playbook.icon || '📦'}</span>
            <span class="badge-tag">${escapeHtml(playbook.badge || playbook.category || 'Playbook')}</span>
          </div>
          <div class="playbook-card-title">${escapeHtml(playbook.title)}</div>
          <div class="playbook-card-desc">${escapeHtml(playbook.description)}</div>
        </div>
        <div class="playbook-card-footer">
          <span>Workflow: <code>${escapeHtml(playbook.workflowFile)}</code></span>
          <span>${isSelected ? '● Active' : 'Select →'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (activePlaybookId !== playbook.id) {
          activePlaybookId = playbook.id;
          renderPlaybookSelector();
          renderActivePlaybookForm();
        }
      });

      playbookGrid.appendChild(card);
    });
  }

  function renderActivePlaybookForm() {
    const playbook = getActivePlaybook();
    if (!playbook) return;

    selectedPlaybookIcon.textContent = playbook.icon || '📦';
    selectedPlaybookTitle.textContent = playbook.title;
    selectedPlaybookBadge.textContent = playbook.badge || playbook.category || 'Playbook';
    selectedPlaybookDesc.textContent = playbook.description;
    workflowFile.value = playbook.workflowFile;

    dynamicInputsContainer.innerHTML = '';

    if (playbook.type === 'multi_block') {
      multiBlockControls.style.display = 'block';
      statsBar.style.display = 'flex';
      renderMultiBlockForm();
    } else {
      multiBlockControls.style.display = 'none';
      statsBar.style.display = 'none';
      renderFieldsForm(playbook);
    }

    updateDispatchButtonText();
  }

  // 4. Multi-Block Renderer (for aoscx_run_command)
  function parseDevices(raw) {
    if (!raw) return [];
    return raw
      .replace(/[\r\n]+/g, ',')
      .replace(/\s+/g, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  function renderMultiBlockForm() {
    const playbook = getActivePlaybook();
    const presets = playbook.presets || [];

    dynamicInputsContainer.innerHTML = '';

    multiBlocks.forEach((block, index) => {
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
            ${multiBlocks.length > 1 ? `
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
            ${presets.map(cmd => {
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

      dynamicInputsContainer.appendChild(card);
    });

    attachMultiBlockEvents();
    updateMultiBlockTotals();
  }

  function attachMultiBlockEvents() {
    document.querySelectorAll('.block-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = multiBlocks.find(b => b.id === id);
        if (block) block.name = e.target.value;
      });
    });

    document.querySelectorAll('.block-devices-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = multiBlocks.find(b => b.id === id);
        if (block) {
          block.devices = e.target.value;
          updateMultiBlockTotals();
        }
      });
    });

    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cmd = btn.dataset.cmd;
        const block = multiBlocks.find(b => b.id === id);
        if (block) {
          if (block.selectedPresets.includes(cmd)) {
            block.selectedPresets = block.selectedPresets.filter(c => c !== cmd);
          } else {
            block.selectedPresets.push(cmd);
          }
          renderMultiBlockForm();
        }
      });
    });

    document.querySelectorAll('.block-custom-commands').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = multiBlocks.find(b => b.id === id);
        if (block) {
          block.customCommands = e.target.value;
          updateMultiBlockTotals();
        }
      });
    });

    document.querySelectorAll('.delete-block-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (multiBlocks.length <= 1) return;
        const id = btn.dataset.id;
        multiBlocks = multiBlocks.filter(b => b.id !== id);
        renderMultiBlockForm();
        showToast('Block removed', 'info');
      });
    });
  }

  addBlockBtn.addEventListener('click', () => {
    if (multiBlocks.length >= MAX_BLOCKS) {
      showToast(`Maximum ${MAX_BLOCKS} blocks reached.`, 'error');
      return;
    }
    const nextNum = multiBlocks.length + 1;
    multiBlocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      name: `Block ${nextNum}`,
      devices: '',
      selectedPresets: ['show version'],
      customCommands: ''
    });
    renderMultiBlockForm();
    showToast(`Added Block ${nextNum}`, 'success');
  });

  function updateMultiBlockTotals() {
    let totalDevices = 0;
    multiBlocks.forEach(b => {
      totalDevices += parseDevices(b.devices).length;
    });

    totalBlocksSummary.textContent = multiBlocks.length;
    totalDevicesSummary.textContent = totalDevices;

    if (multiBlocks.length >= MAX_BLOCKS) {
      addBlockBtn.disabled = true;
      addBlockBtn.textContent = 'Max 10 Blocks';
    } else {
      addBlockBtn.disabled = false;
      addBlockBtn.textContent = '+ Add Block';
    }

    updateDispatchButtonText();
  }

  // 5. Generic Fields Renderer (for ping_test, firmware_upgrade, etc.)
  function renderFieldsForm(playbook) {
    dynamicInputsContainer.innerHTML = '';
    const fields = playbook.fields || [];

    fields.forEach(field => {
      const fieldId = field.id;
      const currentVal = dynamicFieldValues[fieldId] !== undefined ? dynamicFieldValues[fieldId] : (field.defaultValue || '');
      dynamicFieldValues[fieldId] = currentVal;

      const group = document.createElement('div');
      group.className = 'form-group';

      let inputHtml = '';
      if (field.type === 'textarea') {
        inputHtml = `
          <textarea id="field_${fieldId}" 
            rows="3" 
            placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(currentVal)}</textarea>
        `;
      } else if (field.type === 'select') {
        inputHtml = `
          <select id="field_${fieldId}">
            ${(field.options || []).map(opt => `
              <option value="${escapeHtml(opt.value)}" ${opt.value === currentVal ? 'selected' : ''}>
                ${escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
        `;
      } else {
        inputHtml = `
          <input type="text" id="field_${fieldId}" 
            value="${escapeHtml(currentVal)}" 
            placeholder="${escapeHtml(field.placeholder || '')}">
        `;
      }

      group.innerHTML = `
        <label for="field_${fieldId}">${escapeHtml(field.label)} ${field.required ? '<span style="color: var(--danger);">*</span>' : ''}</label>
        ${inputHtml}
        ${field.helperText ? `<div class="helper-text">${escapeHtml(field.helperText)}</div>` : ''}
      `;

      dynamicInputsContainer.appendChild(group);

      const el = group.querySelector(`#field_${fieldId}`);
      if (el) {
        el.addEventListener('input', (e) => {
          dynamicFieldValues[fieldId] = e.target.value;
        });
      }
    });
  }

  function updateDispatchButtonText() {
    const playbook = getActivePlaybook();
    if (!playbook) return;

    if (playbook.type === 'multi_block') {
      dispatchBtnText.textContent = `🚀 Initiate Action Workflow (${multiBlocks.length} ${multiBlocks.length === 1 ? 'Block' : 'Blocks'})`;
    } else {
      dispatchBtnText.textContent = `🚀 Initiate Action Workflow (${playbook.title})`;
    }
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

  // 6. Form Submission & Action Dispatch
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiBase = getApiBaseUrl();
    const owner = repoOwnerInput.value.trim();
    const repo = repoNameInput.value.trim();
    const branch = workflowBranchInput.value.trim() || 'main';
    const token = githubTokenInput.value.trim();
    const runner = runnerType.value;

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

    const playbook = getActivePlaybook();
    if (!playbook) {
      showToast('No playbook selected.', 'error');
      return;
    }

    let payloadInputs = {};
    let trackingDevCount = 0;
    let trackingBlockCount = 1;
    let trackingCmdCount = 1;

    // Validate based on playbook type
    if (playbook.type === 'multi_block') {
      const compiledBlocks = [];
      let totalDeviceCount = 0;
      let totalCommandCount = 0;

      for (let i = 0; i < multiBlocks.length; i++) {
        const b = multiBlocks[i];
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

      trackingDevCount = totalDeviceCount;
      trackingBlockCount = compiledBlocks.length;
      trackingCmdCount = totalCommandCount;

      payloadInputs = playbook.buildPayload({
        compiledBlocks: compiledBlocks,
        runnerType: runner
      });

    } else {
      // Validate field-based playbook
      const fields = playbook.fields || [];
      const formValues = {};

      for (let f of fields) {
        const val = dynamicFieldValues[f.id] !== undefined ? dynamicFieldValues[f.id].trim() : '';
        if (f.required && !val) {
          showToast(`Field "${f.label}" is required.`, 'error');
          const el = document.getElementById(`field_${f.id}`);
          if (el) el.focus();
          return;
        }
        formValues[f.id] = val;
      }

      if (formValues.target_hosts) {
        trackingDevCount = parseDevices(formValues.target_hosts).length;
      }

      payloadInputs = playbook.buildPayload({
        formValues: formValues,
        runnerType: runner
      });
    }

    dispatchBtn.disabled = true;
    dispatchBtnText.textContent = 'Dispatching to Runner...';

    try {
      const dispatchUrl = `${apiBase}/repos/${owner}/${repo}/actions/workflows/${playbook.workflowFile}/dispatches`;
      const response = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: branch,
          inputs: payloadInputs
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
      }

      showToast(`Action dispatched for "${playbook.title}"!`, 'success');
      startTrackingRun(apiBase, owner, repo, token, playbook.workflowFile, trackingBlockCount, trackingDevCount, trackingCmdCount);

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      dispatchBtn.disabled = false;
      updateDispatchButtonText();
    }
  });

  // 7. Live Tracker & Polling
  function startTrackingRun(apiBase, owner, repo, token, targetWorkflow, blockCount, devCount, cmdCount) {
    trackerEmptyState.classList.add('hidden');
    trackerActiveState.classList.remove('hidden');

    runBlocksBadge.textContent = `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;
    runTargetBadge.textContent = `${devCount} ${devCount === 1 ? 'Device' : 'Devices'}`;
    runCommandBadge.textContent = getActivePlaybook().title;

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

  // 8. Toast Notifications
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

  // Initial Boot
  initConfig();
  renderPlaybookSelector();
  renderActivePlaybookForm();
});
