// Network Ping & Reachability Test Definition
window.PLAYBOOK_CATALOG = window.PLAYBOOK_CATALOG || {};

window.PLAYBOOK_CATALOG['ping_test'] = {
  id: 'ping_test',
  title: 'Network Reachability Ping Test',
  description: 'Execute ICMP ping tests from the runner to verify network connectivity and packet round-trip time.',
  category: 'Connectivity',
  badge: 'ICMP',
  workflowFile: 'ping_test.yml',
  type: 'fields',

  fields: [
    {
      id: 'target_hosts',
      label: 'Target Hostnames / IP Addresses',
      type: 'textarea',
      placeholder: 'e.g. 192.168.72.128, 8.8.8.8, gateway.corp',
      defaultValue: '192.168.72.128',
      required: true,
      helperText: 'One or multiple hosts separated by commas, spaces, or newlines'
    },
    {
      id: 'ping_count',
      label: 'Ping Packet Count',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: '3 packets (Quick sanity check)', value: '3' },
        { label: '5 packets (Standard)', value: '5' },
        { label: '10 packets (Extended loss check)', value: '10' }
      ],
      helperText: 'Number of ICMP ECHO packets to send per target'
    }
  ],

  buildPayload: (data) => {
    return {
      target_hosts: data.formValues.target_hosts,
      ping_count: data.formValues.ping_count,
      runner_type: data.runnerType
    };
  }
};
