// Aruba AOS-CX Ansible Dispatcher Web App
document.addEventListener('DOMContentLoaded', () => {
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
  const switchHostname = document.getElementById('switchHostname');
  const ipIndicator = document.getElementById('ipIndicator');
  const switchCommand = document.getElementById('switchCommand');
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
    if (githubTokenInput.type === 'password') {
      githubTokenInput.type = 'text';
    } else {
      githubTokenInput.type = 'password';
    }
  });

  clearTokenBtn.addEventListener('click', () => {
    githubTokenInput.value = '';
    localStorage.removeItem('ansible_gh_token');
    showToast('Token cleared from local storage', 'info');
    updateConfigUI(repoOwnerInput.value.trim(), repoNameInput.value.trim(), '');
  });

  // 3. Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCommand.value = btn.dataset.cmd;
      switchCommand.focus();
    });
  });

  // 4. IP Validator Indicator
  switchHostname.addEventListener('input', () => {
    const val = switchHostname.value.trim();
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(val)) {
      ipIndicator.classList.remove('hidden');
    } else {
      ipIndicator.classList.add('hidden');
    }
  });

  // 5. Action Dispatcher
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const owner = localStorage.getItem('ansible_gh_owner') || repoOwnerInput.value.trim();
    const repo = localStorage.getItem('ansible_gh_repo') || repoNameInput.value.trim();
    const branch = localStorage.getItem('ansible_gh_branch') || workflowBranchInput.value.trim() || 'main';
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

    const hostname = switchHostname.value.trim();
    const command = switchCommand.value.trim();
    const runner = runnerType.value;
    const workflow = workflowFile.value.trim();

    // Disable button & show spinner
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
            hostname: hostname,
            command: command,
            runner_type: runner
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub API error: ${response.status} ${response.statusText}`);
      }

      showToast('Action dispatched successfully to runner!', 'success');
      startTrackingRun(owner, repo, token, hostname, command);

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
      dispatchBtnText.textContent = 'Initiate Action Workflow';
    }
  }

  // 6. Run Tracking & Summary Polling
  function startTrackingRun(owner, repo, token, hostname, command) {
    // Reset tracker UI
    trackerEmptyState.classList.add('hidden');
    trackerActiveState.classList.remove('hidden');
    activeRunCard.classList.add('running-glow');

    runTargetBadge.textContent = hostname;
    runCommandBadge.textContent = command;
    runStatusBadge.textContent = 'Queued';
    runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20';
    runStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
    runIdBadge.textContent = '#detecting...';

    viewRunLink.href = `https://github.com/${owner}/${repo}/actions`;
    viewSummaryLink.href = `https://github.com/${owner}/${repo}/actions`;

    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    runStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    // Stop existing polling
    if (pollingInterval) clearInterval(pollingInterval);

    let attempts = 0;
    const maxAttempts = 80; // ~4 minutes

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
              showToast('Ansible playbook completed successfully! Summary is ready.', 'success');
            } else {
              runStatusBadge.textContent = `Failed (${latestRun.conclusion}) ❌`;
              runStatusBadge.className = 'text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20';
              runStatusDot.className = 'w-2 h-2 rounded-full bg-red-400';
              showToast('Action execution failed. Check summary and logs.', 'error');
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

  // 7. Recent Runs Fetcher
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
      if (!res.ok) {
        throw new Error(`Failed to load runs: ${res.status}`);
      }

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
            badgeHtml = `<span class="px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/20">${run.conclusion || 'Failed'}</span>`;
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

  // 8. Toast Notification Utility
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
