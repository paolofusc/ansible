// Aruba AOS-CX Ansible Multi-Block Dispatcher Web App
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
  const dispatchSpinner = document.getElementById('dispatchSpinner');
  const dispatchIcon = document.getElementById('dispatchIcon');
  const dispatchBtnText = document.getElementById('dispatchBtnText');

  const activeRunCard = document.getElementById('activeRunCard');
  const trackerEmptyState = document.getElementById('trackerEmptyState');
  const trackerActiveState = document.getElementById('trackerActiveState');
  const runStatusDot = document.getElementById('runStatusDot');
  const runTimer = document.getElementById('runTimer');
  const runStatusBadge = document.getElementById('runStatusBadge');
  const runBlocksBadge = document.getElementById('runBlocksBadge');
  const runTargetBadge = document.getElementById('runTargetBadge');
  const runCommandBadge = document.getElementById('runCommandBadge');
  const runIdBadge = document.getElementById('runIdBadge');
  const viewRunLink = document.getElementById('viewRunLink');
  const viewSummaryLink = document.getElementById('viewSummaryLink');

  const refreshRunsBtn = document.getElementById('refreshRunsBtn');
  const recentRunsBody = document.getElementById('recentRunsBody');

  let pollingInterval = null;
  let timerInterval = null;
  let runStartTime = null;

  // Blocks State
  let blocks = [
    {
      id: generateId(),
      name: 'Block 1',
      devices: '192.168.72.128',
      selectedPresets: ['show version'],
      customCommands: ''
    }
  ];

  function generateId() {
    return 'block_' + Math.random().toString(36).substring(2, 9);
  }

  // 1. Initialize & Auto-detect Repo settings
  function initConfig() {
    let savedOwner = localStorage.getItem('ansible_gh_owner') || 'paolofusc';
    let savedRepo = localStorage.getItem('ansible_gh_repo') || 'ansible';
    let savedBranch = localStorage.getItem('ansible_gh_branch') || 'main';
    let savedToken = localStorage.getItem('ansible_gh_token') || '';

    // Auto-detect GitHub Pages URL pattern: <owner>.github.io/<repo>/
    if (!savedOwner && window.location.hostname.endsWith('.github.io')) {
      savedOwner = window.location.hostname.replace('.github.io', '');
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        savedRepo = pathParts[0];
      }
    }

    repoOwnerInput.value = savedOwner;
    repoNameInput.value = savedRepo;
    workflowBranchInput.value = savedBranch;
    githubTokenInput.value = savedToken;

    updateConfigUI(savedOwner, savedRepo, savedToken);

    if (savedOwner && savedRepo && savedToken) {
      settingsPanel.classList.add('hidden');
      fetchRecentRuns();
    } else {
      settingsPanel.classList.remove('hidden');
    }

    renderBlocks();
  }

  function updateConfigUI(owner, repo, token) {
    if (owner && repo) {
      repoLink.href = `https://github.com/${owner}/${repo}`;
      if (token) {
        settingsStatusText.textContent = `${owner}/${repo}`;
        settingsStatusText.classList.add('text-emerald-400');
      } else {
        settingsStatusText.textContent = 'Token Required';
        settingsStatusText.classList.remove('text-emerald-400');
      }
    } else {
      repoLink.href = 'https://github.com';
      settingsStatusText.textContent = 'Configure GitHub';
      settingsStatusText.classList.remove('text-emerald-400');
    }
  }

  // 2. Settings Interaction
  toggleSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    const owner = repoOwnerInput.value.trim();
    const repo = repoNameInput.value.trim();
    const branch = workflowBranchInput.value.trim() || 'main';
    const token = githubTokenInput.value.trim();

    localStorage.setItem('ansible_gh_owner', owner);
    localStorage.setItem('ansible_gh_repo', repo);
    localStorage.setItem('ansible_gh_branch', branch);
    localStorage.setItem('ansible_gh_token', token);

    updateConfigUI(owner, repo, token);
    showToast('Settings saved successfully', 'success');
    settingsPanel.classList.add('hidden');

    if (owner && repo && token) {
      fetchRecentRuns();
    }
  });

  toggleTokenVisibility.addEventListener('click', () => {
    githubTokenInput.type = githubTokenInput.type === 'password' ? 'text' : 'password';
  });

  clearTokenBtn.addEventListener('click', () => {
    githubTokenInput.value = '';
    localStorage.removeItem('ansible_gh_token');
    showToast('Token cleared from local storage', 'info');
    updateConfigUI(repoOwnerInput.value.trim(), repoNameInput.value.trim(), '');
  });

  // 3. Helper: Parse Devices
  function parseDevices(raw) {
    if (!raw) return [];
    return raw
      .replace(/[\r\n]+/g, ',')
      .replace(/\s+/g, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 4. Render Blocks UI
  function renderBlocks() {
    blocksContainer.innerHTML = '';

    blocks.forEach((block, index) => {
      const blockIndex = index + 1;
      const parsedDevs = parseDevices(block.devices);
      const customCmdCount = (block.customCommands || '').split('\n').filter(c => c.trim()).length;
      const totalCmdCount = block.selectedPresets.length + customCmdCount;

      const card = document.createElement('div');
      card.className = 'bg-darkbg-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative group transition hover:border-slate-600';
      card.id = `card_${block.id}`;

      card.innerHTML = `
        <!-- Block Card Header -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div class="flex items-center space-x-3">
            <span class="w-6 h-6 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-xs font-mono font-bold">
              ${blockIndex}
            </span>
            <input type="text" value="${escapeHtml(block.name)}" 
              data-id="${block.id}" 
              class="block-name-input bg-transparent font-semibold text-sm text-slate-100 border-b border-transparent hover:border-slate-600 focus:border-orange-500 focus:outline-none transition px-1 py-0.5" 
              placeholder="Block Name (e.g. Core Switches)">
          </div>

          <div class="flex items-center space-x-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-mono ${parsedDevs.length > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}">
              ${parsedDevs.length} ${parsedDevs.length === 1 ? 'device' : 'devices'}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full font-mono ${totalCmdCount > 0 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}">
              ${totalCmdCount} ${totalCmdCount === 1 ? 'cmd' : 'cmds'}
            </span>

            <button type="button" class="duplicate-block-btn p-1 text-slate-400 hover:text-slate-200 transition" data-id="${block.id}" title="Duplicate this block">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
            </button>

            ${blocks.length > 1 ? `
            <button type="button" class="delete-block-btn p-1 text-slate-400 hover:text-red-400 transition" data-id="${block.id}" title="Delete this block">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>` : ''}
          </div>
        </div>

        <!-- Target Devices Textarea -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Target Switches / Hostnames</span>
            <span class="text-[11px] font-normal text-slate-500">Comma, space, or newline separated</span>
          </label>
          <textarea rows="2" 
            data-id="${block.id}" 
            class="block-devices-input w-full bg-darkbg-800 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition resize-y" 
            placeholder="e.g. 192.168.72.128, 192.168.72.129&#10;switch-core-01">${escapeHtml(block.devices)}</textarea>
        </div>

        <!-- Commands Selection -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-2">
            Commands for this Block
          </label>

          <!-- Preset Chips (Multi-Select) -->
          <div class="flex flex-wrap gap-1.5 mb-2.5">
            ${PRESET_COMMANDS.map(cmd => {
              const isSelected = block.selectedPresets.includes(cmd);
              return `
                <button type="button" 
                  data-id="${block.id}" 
                  data-cmd="${escapeHtml(cmd)}" 
                  class="preset-chip px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                    isSelected 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-semibold shadow-sm shadow-orange-500/10' 
                      : 'bg-darkbg-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                  }">
                  ${isSelected ? '✓ ' : ''}${cmd}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Custom Commands Input -->
          <div class="mt-2">
            <input type="text" 
              data-id="${block.id}" 
              value="${escapeHtml(block.customCommands)}"
              placeholder="Additional custom CLI commands (separate with comma or newline)" 
              class="block-custom-commands w-full bg-darkbg-800 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition">
          </div>
        </div>
      `;

      blocksContainer.appendChild(card);
    });

    attachBlockEvents();
    updateGrandTotals();
  }

  function attachBlockEvents() {
    // Block Name edits
    document.querySelectorAll('.block-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const block = blocks.find(b => b.id === id);
        if (block) block.name = e.target.value;
      });
    });

    // Devices Textarea edits
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

    // Preset Command Chips Toggle
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
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

    // Custom Commands edits
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

    // Duplicate Block
    document.querySelectorAll('.duplicate-block-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (blocks.length >= MAX_BLOCKS) {
          showToast(`Maximum ${MAX_BLOCKS} blocks reached.`, 'error');
          return;
        }
        const id = btn.dataset.id;
        const block = blocks.find(b => b.id === id);
        if (block) {
          const newBlock = {
            id: generateId(),
            name: `${block.name} (Copy)`,
            devices: block.devices,
            selectedPresets: [...block.selectedPresets],
            customCommands: block.customCommands
          };
          blocks.push(newBlock);
          renderBlocks();
          showToast(`Block cloned (Total: ${blocks.length})`, 'info');
        }
      });
    });

    // Delete Block
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

  // 5. Add Block Handler
  addBlockBtn.addEventListener('click', () => {
    if (blocks.length >= MAX_BLOCKS) {
      showToast(`Maximum limit of ${MAX_BLOCKS} device blocks reached.`, 'error');
      return;
    }
    const nextNum = blocks.length + 1;
    blocks.push({
      id: generateId(),
      name: `Block ${nextNum}`,
      devices: '',
      selectedPresets: ['show version'],
      customCommands: ''
    });
    renderBlocks();
    showToast(`Added Block ${nextNum}`, 'success');

    // Scroll down to newly added block
    const lastCard = blocksContainer.lastElementChild;
    if (lastCard) {
      lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
      addBlockBtn.classList.add('opacity-50', 'cursor-not-allowed');
      addBlockBtn.innerHTML = `Max ${MAX_BLOCKS} Blocks`;
    } else {
      addBlockBtn.disabled = false;
      addBlockBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      addBlockBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Block
      `;
    }

    dispatchBtnText.textContent = `Initiate Action Workflow (${blocks.length} ${blocks.length === 1 ? 'Block' : 'Blocks'})`;
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

  // 6. Action Dispatcher (Multi-Block)
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const owner = localStorage.getItem('ansible_gh_owner') || repoOwnerInput.value.trim();
    const repo = localStorage.getItem('ansible_gh_repo') || repoNameInput.value.trim();
    const branch = workflowBranchInput.value.trim() || 'main';
    const token = localStorage.getItem('ansible_gh_token') || githubTokenInput.value.trim();

    if (!owner || !repo) {
      showToast('Please specify the Repository Owner and Name in Settings.', 'error');
      settingsPanel.classList.remove('hidden');
      return;
    }

    if (!token) {
      showToast('GitHub Personal Access Token is required to dispatch actions.', 'error');
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
        showToast(`Please enter target switch IPs for ${b.name || 'Block ' + (i + 1)}.`, 'error');
        const card = document.getElementById(`card_${b.id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth' });
          card.querySelector('.block-devices-input').focus();
        }
        return;
      }

      // Parse custom commands
      const customCmds = (b.customCommands || '')
        .replace(/[\r\n]+/g, ',')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const allCmds = Array.from(new Set([...b.selectedPresets, ...customCmds]));
      if (allCmds.length === 0) {
        showToast(`Please select or enter at least one command for ${b.name || 'Block ' + (i + 1)}.`, 'error');
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

    setDispatchingState(true);

    try {
      const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
      const response = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
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
        throw new Error(errorData.message || `GitHub API error: ${response.status} ${response.statusText}`);
      }

      showToast(`Action dispatched for ${compiledBlocks.length} block(s) across ${totalDeviceCount} device(s)!`, 'success');
      startTrackingRun(owner, repo, token, compiledBlocks.length, totalDeviceCount, totalCommandCount);

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setDispatchingState(false);
    }
  });

  function setDispatchingState(isDispatching) {
    if (isDispatching) {
      dispatchBtn.disabled = true;
      dispatchBtn.classList.add('opacity-75', 'cursor-not-allowed');
      dispatchSpinner.classList.remove('hidden');
      dispatchIcon.classList.add('hidden');
      dispatchBtnText.textContent = 'Dispatching to Runner...';
    } else {
      dispatchBtn.disabled = false;
      dispatchBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      dispatchSpinner.classList.add('hidden');
      dispatchIcon.classList.remove('hidden');
      updateGrandTotals();
    }
  }

  // 7. Run Tracking & Polling
  function startTrackingRun(owner, repo, token, blockCount, devCount, cmdCount) {
    trackerEmptyState.classList.add('hidden');
    trackerActiveState.classList.remove('hidden');
    activeRunCard.classList.add('running-glow');

    runBlocksBadge.textContent = `${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;
    runTargetBadge.textContent = `${devCount} ${devCount === 1 ? 'Device' : 'Devices'}`;
    runCommandBadge.textContent = `${cmdCount} ${cmdCount === 1 ? 'Command' : 'Commands'}`;

    runStatusBadge.textContent = 'Queued';
    runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
    runStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
    runIdBadge.textContent = '#detecting...';

    viewRunLink.href = `https://github.com/${owner}/${repo}/actions`;
    viewSummaryLink.href = `https://github.com/${owner}/${repo}/actions`;

    if (timerInterval) clearInterval(timerInterval);
    runStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    if (pollingInterval) clearInterval(pollingInterval);

    let attempts = 0;
    const maxAttempts = 80;

    pollingInterval = setInterval(async () => {
      attempts++;
      try {
        const listUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=5`;
        const res = await fetch(listUrl, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
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
            runStatusBadge.textContent = 'In Progress';
            runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20';
            runStatusDot.className = 'w-2 h-2 rounded-full bg-blue-400 animate-pulse';
          } else if (latestRun.status === 'completed') {
            clearInterval(pollingInterval);
            clearInterval(timerInterval);
            activeRunCard.classList.remove('running-glow');

            if (latestRun.conclusion === 'success') {
              runStatusBadge.textContent = 'Success ✅';
              runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
              runStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
              showToast('Ansible multi-block execution completed successfully!', 'success');
            } else {
              runStatusBadge.textContent = `Finished (${latestRun.conclusion}) ⚠️`;
              runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
              runStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
              showToast('Action execution finished. Check summary for details.', 'info');
            }

            fetchRecentRuns();
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollingInterval);
          clearInterval(timerInterval);
          activeRunCard.classList.remove('running-glow');
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

  // 8. Recent Runs Fetcher
  async function fetchRecentRuns() {
    const owner = localStorage.getItem('ansible_gh_owner') || repoOwnerInput.value.trim();
    const repo = localStorage.getItem('ansible_gh_repo') || repoNameInput.value.trim();
    const token = localStorage.getItem('ansible_gh_token') || githubTokenInput.value.trim();

    if (!owner || !repo) return;

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=6`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Failed to load runs: ${res.status}`);

      const data = await res.json();
      const runs = data.workflow_runs || [];

      if (runs.length === 0) {
        recentRunsBody.innerHTML = `
          <tr>
            <td colspan="5" class="py-6 text-center text-slate-500 font-sans">
              No workflow runs found yet for this repository.
            </td>
          </tr>
        `;
        return;
      }

      recentRunsBody.innerHTML = runs.map(run => {
        let badgeHtml = '';
        if (run.status === 'completed') {
          if (run.conclusion === 'success') {
            badgeHtml = '<span class="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Success</span>';
          } else {
            badgeHtml = `<span class="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">${run.conclusion || 'Failed'}</span>`;
          }
        } else if (run.status === 'in_progress') {
          badgeHtml = '<span class="px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">Running</span>';
        } else {
          badgeHtml = '<span class="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Queued</span>';
        }

        const dateStr = new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return `
          <tr class="hover:bg-slate-800/50 transition">
            <td class="py-3 px-3 font-semibold text-slate-200">#${run.id}</td>
            <td class="py-3 px-3">${badgeHtml}</td>
            <td class="py-3 px-3 text-slate-400">${run.actor ? run.actor.login : 'user'}</td>
            <td class="py-3 px-3 text-slate-400">${dateStr}</td>
            <td class="py-3 px-3 text-right">
              <a href="${run.html_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 transition text-[11px]">
                Summary ↗
              </a>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.warn('Could not fetch runs:', err);
    }
  }

  refreshRunsBtn.addEventListener('click', fetchRecentRuns);

  // 9. Toast Notification Utility
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium border';

    if (type === 'success') {
      toast.classList.add('bg-emerald-950', 'text-emerald-200', 'border-emerald-700/60');
      toast.innerHTML = `<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> <span>${message}</span>`;
    } else if (type === 'error') {
      toast.classList.add('bg-red-950', 'text-red-200', 'border-red-700/60');
      toast.innerHTML = `<svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> <span>${message}</span>`;
    } else {
      toast.classList.add('bg-slate-800', 'text-slate-200', 'border-slate-700');
      toast.innerHTML = `<svg class="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> <span>${message}</span>`;
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // Initialize
  initConfig();
});
