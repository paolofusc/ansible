#!/usr/bin/env python3
import json
import os
import glob
import sys

# Ensure stdout supports UTF-8 on Windows/Linux
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
    runner_type = os.environ.get('RUNNER_TYPE', 'self-hosted')
    playbook_outcome = os.environ.get('PLAYBOOK_OUTCOME', 'unknown')

    meta = {}
    if os.path.exists('summary_blocks.json'):
        try:
            with open('summary_blocks.json', 'r') as f:
                meta = json.load(f)
        except Exception as e:
            print(f"Warning reading summary_blocks.json: {e}", file=sys.stderr)

    total_blocks = meta.get('total_blocks', 1)
    total_devices = meta.get('total_devices', 0)
    blocks = meta.get('blocks', [])

    summary = []
    summary.append("## 🌐 Aruba AOS-CX Multi-Block Execution Summary\n")
    summary.append("| Parameter | Value |")
    summary.append("| :--- | :--- |")
    summary.append(f"| **Total Blocks** | `{total_blocks}` |")
    summary.append(f"| **Total Target Devices** | `{total_devices}` |")
    summary.append(f"| **Runner** | `{runner_type}` |")
    
    if playbook_outcome == 'success':
        summary.append("| **Overall Status** | 🟢 **Success** |")
    else:
        summary.append("| **Overall Status** | ⚠️ **Completed with warnings / errors** |")
    summary.append("")

    if blocks:
        summary.append("### 📦 Device Blocks Configuration\n")
        summary.append("| Block | Target Devices | Commands Executed |")
        summary.append("| :--- | :--- | :--- |")
        for blk in blocks:
            dev_badges = ', '.join([f"`{d}`" for d in blk.get('devices', [])])
            cmd_lines = '<br>'.join([f"• <code>{c}</code>" for c in blk.get('commands', [])])
            summary.append(f"| **{blk.get('name', 'Block')}** | {dev_badges} | {cmd_lines} |")
        summary.append("")

    processed_files = set()

    # 1. Output organized by Block
    if blocks:
        summary.append("### 📋 Captured Outputs by Block\n")
        for blk in blocks:
            block_id = blk.get('id', '')
            block_name = blk.get('name', 'Block')
            devices = blk.get('devices', [])

            summary.append(f"#### 🏷️ {block_name}\n")

            has_block_output = False
            for dev in devices:
                out_path = f"{block_id}_{dev}_output.txt"
                err_path = f"{block_id}_{dev}_error.txt"

                if os.path.exists(out_path):
                    has_block_output = True
                    processed_files.add(out_path)
                    try:
                        with open(out_path, 'r', errors='ignore') as of:
                            content = of.read()
                    except Exception:
                        content = "Could not read output file."

                    summary.append(f"<details open><summary><b>Switch <code>{dev}</code> Output</b></summary>\n")
                    summary.append("```text")
                    summary.append(content)
                    summary.append("```\n</details>\n")

                if os.path.exists(err_path):
                    has_block_output = True
                    processed_files.add(err_path)
                    try:
                        with open(err_path, 'r', errors='ignore') as ef:
                            err_msg = ef.read().strip()
                    except Exception:
                        err_msg = "Unknown error."

                    summary.append("> [!WARNING]")
                    summary.append(f"> **Error connecting to switch <code>{dev}</code>**")
                    summary.append("> ```text")
                    summary.append(f"> {err_msg}")
                    summary.append("> ```\n")

            if not has_block_output:
                summary.append("> [!WARNING]\n> No outputs captured for devices in this block.\n")

    # 2. Check for any remaining unprocessed output/error files (e.g. legacy single runs)
    other_outputs = [f for f in sorted(glob.glob("*_output.txt")) if f not in processed_files]
    if other_outputs:
        if not blocks:
            summary.append("### 📋 Captured Device Outputs\n")
        else:
            summary.append("### 📋 Additional Device Outputs\n")
        for file in other_outputs:
            dev_name = file[:-11]
            try:
                with open(file, 'r', errors='ignore') as of:
                    content = of.read()
            except Exception:
                content = "Could not read output file."

            summary.append(f"<details open><summary><b>Output for <code>{dev_name}</code></b></summary>\n")
            summary.append("```text")
            summary.append(content)
            summary.append("```\n</details>\n")

    summary_text = '\n'.join(summary) + '\n'

    if summary_file:
        with open(summary_file, 'a', encoding='utf-8') as sf:
            sf.write(summary_text)
    else:
        print(summary_text)

if __name__ == "__main__":
    main()
