"""
deploy_livery.py
----------------
Copies a generated .tga file into the correct iRacing paint folder on Windows.

iRacing paint file naming convention:
    car_<customerID>.tga          – main car texture
    car_<customerID>_spec.tga     – specular map (optional)
    helmet_<customerID>.tga       – helmet (not used here)
    suit_<customerID>.tga         – suit   (not used here)

iRacing paint folder:
    %USERPROFILE%\Documents\iRacing\paint\<car_folder_name>\

Usage:
    python deploy_livery.py \
        --tga path/to/livery.tga \
        --car porsche_911_gt3_r_2023 \
        --customer-id 123456

The script resolves the Documents folder correctly whether or not
OneDrive redirection is active.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import winreg
from pathlib import Path


# ─── Car folder resolution ───────────────────────────────────────────────────
# Cars are configured by the user in the app (stored in config.json).
# The folder name passed here must exactly match the subfolder under
#   Documents\iRacing\paint\<folder>
# ─────────────────────────────────────────────────────────────────────────────

# Keep empty dicts so any code that imports these names doesn't break
CAR_FOLDER_MAP: dict[str, str] = {}
CAR_DISPLAY_NAMES: dict[str, str] = {}


def get_documents_folder() -> Path:
    """
    Resolve the user's Documents folder correctly, handling OneDrive redirection.
    Falls back to %USERPROFILE%\\Documents if registry lookup fails.
    """
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
        )
        docs_path, _ = winreg.QueryValueEx(key, "Personal")
        winreg.CloseKey(key)
        return Path(docs_path)
    except Exception:
        return Path(os.environ["USERPROFILE"]) / "Documents"


def resolve_car_folder(car_name: str) -> str:
    """Return the iRacing paint folder name for the given car.

    Since cars are now configured entirely by the user, the value passed in
    is already the exact folder name — just strip whitespace and return it.
    """
    return car_name.strip()


def get_iracing_paint_dir(car_folder: str) -> Path:
    """Return the full path to the iRacing paint directory for a given car."""
    docs = get_documents_folder()
    return docs / "iRacing" / "paint" / car_folder


def build_target_filename(customer_id: str | int) -> str:
    """Return the expected iRacing paint filename for a customer ID."""
    return f"car_{customer_id}.tga"


def build_spec_target_filename(customer_id: str | int) -> str:
    """Return the expected iRacing specular map filename for a customer ID."""
    return f"car_spec_{customer_id}.tga"


def deploy_livery(
    tga_path: str,
    car_name: str,
    customer_id: str | int,
    dry_run: bool = False,
) -> Path:
    """
    Copy tga_path into the correct iRacing paint folder.
    Returns the destination path.
    """
    tga_src = Path(tga_path)
    if not tga_src.exists():
        raise FileNotFoundError(f"Source TGA not found: {tga_src}")

    car_folder  = resolve_car_folder(car_name)
    paint_dir   = get_iracing_paint_dir(car_folder)
    target_name = build_target_filename(customer_id)
    dest        = paint_dir / target_name

    print(f"[deploy_livery] Source : {tga_src}")
    print(f"[deploy_livery] Target : {dest}")

    if dry_run:
        print("[deploy_livery] DRY RUN — no files written.")
        return dest

    paint_dir.mkdir(parents=True, exist_ok=True)

    # Back up existing file if present
    if dest.exists():
        backup = dest.with_suffix(f".tga.bak")
        print(f"[deploy_livery] Backing up existing → {backup}")
        shutil.copy2(dest, backup)

    shutil.copy2(tga_src, dest)
    print(f"[deploy_livery] ✓ Deployed to {dest}")
    return dest


def deploy_spec_livery(
    tga_path: str,
    car_name: str,
    customer_id: str | int,
    dry_run: bool = False,
) -> Path:
    """
    Copy tga_path into the correct iRacing paint folder as a specular map.
    The file is named car_spec_<customer_id>.tga.
    Returns the destination path.
    """
    tga_src = Path(tga_path)
    if not tga_src.exists():
        raise FileNotFoundError(f"Source TGA not found: {tga_src}")

    car_folder  = resolve_car_folder(car_name)
    paint_dir   = get_iracing_paint_dir(car_folder)
    target_name = build_spec_target_filename(customer_id)
    dest        = paint_dir / target_name

    print(f"[deploy_spec_livery] Source : {tga_src}")
    print(f"[deploy_spec_livery] Target : {dest}")

    if dry_run:
        print("[deploy_spec_livery] DRY RUN — no files written.")
        return dest

    paint_dir.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        backup = dest.with_suffix(".tga.bak")
        print(f"[deploy_spec_livery] Backing up existing → {backup}")
        shutil.copy2(dest, backup)

    shutil.copy2(tga_src, dest)
    print(f"[deploy_spec_livery] ✓ Deployed to {dest}")
    return dest


# ─── CLI entry point ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Deploy a .tga livery to iRacing")
    parser.add_argument("--tga",         required=True, help="Path to the .tga file")
    parser.add_argument("--car",         required=True, help="Car name/alias (see CAR_FOLDER_MAP)")
    parser.add_argument("--customer-id", required=True, help="Your iRacing customer ID")
    parser.add_argument("--dry-run",     action="store_true", help="Show where file would go, don't copy")
    args = parser.parse_args()

    deploy_livery(
        tga_path=args.tga,
        car_name=args.car,
        customer_id=args.customer_id,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
