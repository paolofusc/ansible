// Aruba AOS-CX Firmware Upgrade Definition
window.PLAYBOOK_CATALOG = window.PLAYBOOK_CATALOG || {};

window.PLAYBOOK_CATALOG['aoscx_firmware_upgrade'] = {
  id: 'aoscx_firmware_upgrade',
  title: 'Aruba AOS-CX Firmware Upgrade',
  description: 'Pre-check switch baseline, transfer firmware image, stage boot partition, and control reboot.',
  category: 'Maintenance & Lifecycle',
  badge: 'Lifecycle',
  icon: '🚀',
  workflowFile: 'aoscx_firmware_upgrade.yml',
  type: 'fields',

  fields: [
    {
      id: 'target_hosts',
      label: 'Target Switch Hostnames / IPs',
      type: 'textarea',
      placeholder: 'e.g. 192.168.72.128, 192.168.72.129',
      defaultValue: '192.168.72.128',
      required: true,
      helperText: 'Enter switch IP addresses (comma, space, or newline separated)'
    },
    {
      id: 'image_url',
      label: 'Firmware Image Source URL',
      type: 'text',
      placeholder: 'http://192.168.72.1/images/TL_10_10_0001.afi or tftp://...',
      defaultValue: 'http://192.168.72.1/images/ArubaOS-CX.afi',
      required: true,
      helperText: 'HTTP, TFTP, or SFTP reachable from the switches'
    },
    {
      id: 'partition',
      label: 'Target Flash Partition',
      type: 'select',
      defaultValue: 'secondary',
      options: [
        { label: 'secondary (Recommended for staging)', value: 'secondary' },
        { label: 'primary', value: 'primary' }
      ],
      helperText: 'Which flash bank to write the new firmware image to'
    },
    {
      id: 'reboot_policy',
      label: 'Reboot Action',
      type: 'select',
      defaultValue: 'stage_only',
      options: [
        { label: 'Stage only — do NOT reboot (Wait for maintenance window)', value: 'stage_only' },
        { label: 'Reboot switch immediately after install', value: 'reboot_now' }
      ],
      helperText: 'Control whether switch reloads immediately to active new image'
    }
  ],

  buildPayload: (data) => {
    return {
      target_hosts: data.formValues.target_hosts,
      image_url: data.formValues.image_url,
      partition: data.formValues.partition,
      reboot_policy: data.formValues.reboot_policy,
      runner_type: data.runnerType
    };
  }
};
