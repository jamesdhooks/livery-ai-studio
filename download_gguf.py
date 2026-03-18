#!/usr/bin/env python3
"""
download_gguf.py
----------------
Download SeedVR2 GGUF quantized model from HuggingFace.

Usage:
    python download_gguf.py /path/to/seedvr2_videoupscaler
"""

import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# Model details
GGUF_URL = "https://huggingface.co/numz/SeedVR2/resolve/main/seedvr2_ema_3b-Q8_0.gguf"
GGUF_FILENAME = "seedvr2_ema_3b-Q8_0.gguf"
GGUF_SIZE_GB = 2.4


def human_readable_size(bytes_size: int) -> str:
    """Convert bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} TB"


def download_with_progress(url: str, filepath: Path) -> bool:
    """Download file with progress bar."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    temp_filepath = filepath.with_suffix(filepath.suffix + '.downloading')
    
    try:
        print(f"[GGUF] Downloading from: {url}")
        print(f"[GGUF] Saving to: {filepath}")
        
        def progress_hook(block_num: int, block_size: int, total_size: int) -> None:
            """Display download progress."""
            if total_size <= 0:
                return
            
            downloaded = block_num * block_size
            if downloaded > total_size:
                downloaded = total_size
            
            pct = (downloaded * 100) // total_size
            mb_downloaded = downloaded / (1024 * 1024)
            mb_total = total_size / (1024 * 1024)
            
            # Progress bar: ████░░░░░░ 50%
            bar_length = 40
            filled = (pct * bar_length) // 100
            bar = "█" * filled + "░" * (bar_length - filled)
            
            sys.stdout.write(
                f"\r[{bar}] {pct:3d}% ({mb_downloaded:7.1f} / {mb_total:7.1f} MB)"
            )
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, temp_filepath, progress_hook)
        print()  # Newline after progress bar
        
        # Rename temp file to final name
        temp_filepath.rename(filepath)
        
        print(f"[GGUF] ✓ Successfully downloaded {human_readable_size(filepath.stat().st_size)}")
        return True
        
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"\n[GGUF] ✗ Authentication required (HTTP 401)")
            print(f"[GGUF] The GGUF model URL may require manual download or authentication.")
        else:
            print(f"\n[GGUF] ✗ HTTP Error {e.code}: {e.reason}")
        if temp_filepath.exists():
            temp_filepath.unlink()
        return False
    except urllib.error.URLError as e:
        print(f"\n[GGUF] ✗ Network error: {e}")
        if temp_filepath.exists():
            temp_filepath.unlink()
        return False
    except Exception as e:
        print(f"\n[GGUF] ✗ Error: {e}")
        if temp_filepath.exists():
            temp_filepath.unlink()
        return False


def main():
    """Download GGUF model if not already present."""
    if len(sys.argv) < 2:
        print("Usage: python download_gguf.py /path/to/seedvr2_videoupscaler")
        sys.exit(1)
    
    seedvr2_dir = Path(sys.argv[1])
    gguf_path = seedvr2_dir / GGUF_FILENAME
    
    # Check if already exists
    if gguf_path.exists():
        size_mb = gguf_path.stat().st_size / (1024 * 1024)
        print(f"[GGUF] Model already exists: {gguf_path} ({size_mb:.1f} MB)")
        sys.exit(0)
    
    # Download
    print(f"[GGUF] Downloading SeedVR2 GGUF model (~{GGUF_SIZE_GB} GB)")
    success = download_with_progress(GGUF_URL, gguf_path)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
