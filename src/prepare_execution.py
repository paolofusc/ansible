#!/usr/bin/env python3
import json
import os
import sys
import yaml

def parse_devices(raw):
    """Normalize input into a list of cleaned unique hostnames/IPs."""
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        items = raw.replace('\r\n', ',').replace('\n', ',').replace(' ', ',').split(',')
    else:
        items = []
        
    cleaned = []
    for item in items:
        h = str(item).strip()
        if h and h not in cleaned:
            cleaned.append(h)
    return cleaned

def parse_commands(raw):
    """Normalize input into a list of cleaned command strings."""
    if isinstance(raw, list):
        cmds = [str(c).strip() for c in raw if str(c).strip()]
    elif isinstance(raw, str):
        cmds = [line.strip() for line in raw.splitlines() if line.strip()]
    else:
        cmds = []
    return cmds

def main():
    blocks_json_str = os.environ.get('INPUT_BLOCKS_JSON', '').strip()
    fallback_hostname = os.environ.get('INPUT_HOSTNAME', '').strip()
    fallback_command = os.environ.get('INPUT_COMMAND', '').strip()

    blocks = []
    if blocks_json_str:
        try:
            data = json.loads(blocks_json_str)
            if isinstance(data, list):
                blocks = data
        except Exception as e:
            print(f"Warning: Failed to parse INPUT_BLOCKS_JSON: {e}", file=sys.stderr)

    # Fallback to single block if blocks_json wasn't provided or empty
    if not blocks:
        devices = parse_devices(fallback_hostname)
        cmds = parse_commands(fallback_command)
        if devices:
            blocks = [{
                "name": "Block 1",
                "devices": devices,
                "commands": cmds if cmds else ["show version"]
            }]

    if not blocks:
        print("Error: No devices specified across any blocks!", file=sys.stderr)
        sys.exit(1)

    # Enforce maximum of 10 blocks
    blocks = blocks[:10]

    ini_lines = []
    playbook_plays = []
    summary_blocks = []
    all_devices = []

    for i, block in enumerate(blocks, start=1):
        group_name = f"block_{i}"
        block_label = block.get('name') or f"Block {i}"
        devices = parse_devices(block.get('devices', []))
        commands = parse_commands(block.get('commands', []))

        if not devices:
            continue

        if not commands:
            commands = ["show version"]

        for d in devices:
            if d not in all_devices:
                all_devices.append(d)

        summary_blocks.append({
            "id": group_name,
            "name": block_label,
            "devices": devices,
            "commands": commands
        })

        # INI inventory group
        ini_lines.append(f"[{group_name}]")
        for dev in devices:
            ini_lines.append(dev)
        ini_lines.append("")

        # Generate Ansible play for this block
        play = {
            "name": f"Execute on {block_label} ({len(devices)} device{'s' if len(devices) > 1 else ''})",
            "hosts": group_name,
            "gather_facts": False,
            "vars": {
                "ansible_host": "{{ inventory_hostname }}",
                "ansible_connection": "arubanetworks.aoscx.aoscx",
                "ansible_network_os": "arubanetworks.aoscx.aoscx",
                "ansible_aoscx_rest_version": 10.09,
                "block_id": group_name,
                "block_label": block_label,
                "commands_to_run": commands
            },
            "tasks": [
                {
                    "name": "Run commands on switch",
                    "arubanetworks.aoscx.aoscx_command": {
                        "commands": "{{ commands_to_run }}"
                    },
                    "register": "command_output",
                    "ignore_errors": True,
                    "ignore_unreachable": True,
                    "vars": {
                        "ansible_connection": "network_cli",
                        "ansible_network_cli_ssh_type": "paramiko"
                    }
                },
                {
                    "name": "Save formatted command output to local file",
                    "ansible.builtin.copy": {
                        "content": (
                            "{% for cmd in commands_to_run %}\n"
                            "================================================================================\n"
                            "COMMAND: {{ cmd }}\n"
                            "================================================================================\n"
                            "{{ (command_output.stdout[loop.index0] if (command_output.stdout is defined and command_output.stdout | length > loop.index0) else '') | trim }}\n\n"
                            "{% endfor %}"
                        ),
                        "dest": "{{ block_id }}_{{ inventory_hostname }}_output.txt"
                    },
                    "delegate_to": "localhost",
                    "when": "command_output.stdout is defined and command_output.stdout | length > 0"
                },
                {
                    "name": "Save failure details to local file",
                    "ansible.builtin.copy": {
                        "content": "Error connecting to {{ inventory_hostname }}: {{ command_output.msg | default('Unknown error or host unreachable') }}",
                        "dest": "{{ block_id }}_{{ inventory_hostname }}_error.txt"
                    },
                    "delegate_to": "localhost",
                    "when": "(command_output.failed is defined and command_output.failed) or (command_output.unreachable is defined and command_output.unreachable)"
                }
            ]
        }
        playbook_plays.append(play)

    if not playbook_plays:
        print("Error: No valid blocks with target devices were configured.", file=sys.stderr)
        sys.exit(1)

    # Write dynamic inventory
    with open("dynamic_inventory.ini", "w") as f:
        f.write("\n".join(ini_lines))

    # Write dynamic playbook
    with open("dynamic_playbook.yml", "w") as f:
        yaml.dump(playbook_plays, f, sort_keys=False)

    # Write summary metadata for step summary formatting
    with open("summary_blocks.json", "w") as f:
        json.dump({
            "total_blocks": len(summary_blocks),
            "total_devices": len(all_devices),
            "blocks": summary_blocks
        }, f, indent=2)

    print(f"Successfully generated dynamic configuration for {len(summary_blocks)} block(s) and {len(all_devices)} device(s).")

if __name__ == "__main__":
    main()
