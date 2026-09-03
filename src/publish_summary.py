#!/usr/bin/env python3
import json
import os
import glob
import sys

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

    output_files = sorted(glob.glob("*_output.txt"))
    if output_files:
        summary.append("### 📋 Captured Device Outputs\n")
        for file in output_files:
            dev_name = file[:-11]  # strip '_output.txt'
            try:
                with open(file, 'r', errors='ignore') as of:
                    content = of.read()
            except Exception:
                content = "Could not read output file."

            summary.append(f"<details open><summary><b>Output for <code>{dev_name}</code></b></summary>\n")
            summary.append("```text")
            summary.append(content)
            summary.append("```\n</details>\n")

    error_files = sorted(glob.glob("*_error.txt"))
    if error_files:
        summary.append("### ⚠️ Connection / Execution Errors\n")
        for errfile in error_files:
            dev_name = errfile[:-10]  # strip '_error.txt'
            try:
                with open(errfile, 'r', errors='ignore') as ef:
                    err_msg = ef.read().strip()
            except Exception:
                err_msg = "Unknown error."

            summary.append("> [!WARNING]")
            summary.append(f"> **Error connecting to switch <code>{dev_name}</code>**")
            summary.append("> ```text")
            summary.append(f"> {err_msg}")
            summary.append("> ```\n")

    if not output_files and not error_files:
        summary.append("> [!WARNING]")
        summary.append("> No output files were captured from switches. Please review step logs for details.\n")

    summary_text = '\n'.join(summary) + '\n'

    if summary_file:
        with open(summary_file, 'a', encoding='utf-8') as sf:
            sf.write(summary_text)
    else:
        print(summary_text)

if __name__ == "__main__":
    main()
