#!/usr/bin/env python3
"""Patch basicsr to use torchvision.transforms.functional instead of functional_tensor."""

import site
import pathlib
import re
import sys

# Try multiple possible locations
possible_dirs = [
    pathlib.Path(site.getsitepackages()[0]) / 'basicsr',
    pathlib.Path(site.getsitepackages()[-1]) / 'basicsr' if len(site.getsitepackages()) > 1 else None,
]

basicsr_dir = None
for d in possible_dirs:
    if d and d.exists():
        basicsr_dir = d
        break

if not basicsr_dir or not basicsr_dir.exists():
    print(f"basicsr not found in site-packages")
    print(f"  Checked: {[str(d) for d in possible_dirs if d]}")
    sys.exit(0)

print(f"Found basicsr at: {basicsr_dir.parent.name}")

count = 0
for f in basicsr_dir.rglob('*.py'):
    if not f.is_file():
        continue
    
    try:
        content = f.read_text(encoding='utf-8')
    except:
        continue
    
    if 'functional_tensor' not in content:
        continue
    
    # Replace the import
    new_content = re.sub(
        r'from torchvision\.transforms\.functional_tensor',
        'from torchvision.transforms.functional',
        content
    )
    
    if new_content != content:
        f.write_text(new_content, encoding='utf-8')
        count += 1
        print(f"  Patched: {f.name}")

print(f"  + Fixed {count} file(s)")

