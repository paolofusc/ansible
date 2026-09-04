// Aruba AOS-CX Multi-Block Run Commands Definition
window.PLAYBOOK_CATALOG = window.PLAYBOOK_CATALOG || {};

window.PLAYBOOK_CATALOG['aoscx_run_command'] = {
  id: 'aoscx_run_command',
  title: 'Aruba AOS-CX Run Commands',
  description: 'Execute CLI show and diagnostic commands across up to 10 independent device blocks.',
  category: 'Diagnostics & Operations',
  badge: 'Multi-Block',
  icon: '⚡',
  workflowFile: 'aoscx_run_command.yml',
  type: 'multi_block', // Tells the engine to render the multi-block device manager

  // Preset commands for quick selection
  presets: [
    'show version',
    'show running-config',
    'show vlan',
    'show interface brief',
    'show lldp info remote-device',
    'show mac-address-table',
    'show ip route',
    'show environment'
  ],

  // Payload transform function
  buildPayload: (data) => {
    return {
      blocks_json: JSON.stringify(data.compiledBlocks),
      runner_type: data.runnerType
    };
  }
};
