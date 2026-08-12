import argparse
import hashlib
import os
from pathlib import Path
from typing import Dict, Iterable

import requests


FILES: Dict[str, str] = {
    "asset/Decoder.safetensors": "77aa55e0a977949c4733df3c6f876fa85860d3298cba63295a7bc6901729d4e0",
    "asset/DVAE.safetensors": "1d0b044a8368c0513100a2eca98456b289e6be6a18b7a63be1bcaa315ea874d9",
    "asset/Embed.safetensors": "2ff0be7134934155741b643b74e32fb6bf3eec41257984459b2ed60cdb4c48b0",
    "asset/Vocos.safetensors": "07e5561491cce41f7f90cfdb94b2ff263ff5742c3d89339db99b17ad82cc3f44",
    "asset/gpt/config.json": "0aaa1ecd96c49ad4f473459eb1982fa7ad79fa5de08cde2781bf6ad1f9a0c236",
    "asset/gpt/model.safetensors": "cd0806fd971f52f6a22c923ec64982b305e817bcc41ca83417fcf9141b984a0f",
    "asset/tokenizer/special_tokens_map.json": "bd0ac9d9bb1657996b5c5fbcaa7d80f8de530d01a283da97f89deae5b1b8d011",  # gitleaks:allow - ChatTTS asset SHA256 checksum, not a secret.
    "asset/tokenizer/tokenizer_config.json": "43e9d658b554fa5ee8d8e1d763349323bfef1ed7a89c0794220ab8861387d421",  # gitleaks:allow - ChatTTS asset SHA256 checksum, not a secret.
    "asset/tokenizer/tokenizer.json": "843838a64e121e23e774cc75874c6fe862198d9f7dd43747914633a8fd89c20e",  # gitleaks:allow - ChatTTS asset SHA256 checksum, not a secret.
}

DEFAULT_BASE_URLS = (
    "https://hf-mirror.com/2Noise/ChatTTS/resolve/main",
    "https://huggingface.co/2Noise/ChatTTS/resolve/main",
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def is_valid(path: Path, expected: str) -> bool:
    return path.exists() and path.is_file() and sha256_file(path) == expected


def download_once(url: str, target: Path, expected_sha: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(f"{target.name}.part")
    headers = {"User-Agent": "zxt-chattts-downloader/1.0"}
    resume_from = part.stat().st_size if part.exists() else 0
    if resume_from > 0:
        headers["Range"] = f"bytes={resume_from}-"

    with requests.get(url, stream=True, timeout=(20, 120), headers=headers) as response:
        if response.status_code == 416:
            if is_valid(part, expected_sha):
                part.replace(target)
                return
            part.unlink(missing_ok=True)
            raise RuntimeError("remote refused resume and partial file is invalid")
        if response.status_code not in (200, 206):
            raise RuntimeError(f"HTTP {response.status_code}")
        mode = "ab" if response.status_code == 206 and resume_from > 0 else "wb"
        if mode == "wb" and part.exists():
            part.unlink()
        with part.open(mode) as f:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

    digest = sha256_file(part)
    if digest != expected_sha:
        raise RuntimeError(f"sha256 mismatch: expected {expected_sha}, got {digest}")
    part.replace(target)


def candidate_urls(rel_path: str, base_urls: Iterable[str]) -> Iterable[str]:
    clean_rel = rel_path.replace("\\", "/")
    for base in base_urls:
        yield f"{base.rstrip('/')}/{clean_rel}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Download ChatTTS assets for local CPU inference.")
    parser.add_argument("--target", default=str(Path(__file__).resolve().parents[1] / "storage" / "models" / "chattts"))
    parser.add_argument("--base-url", action="append", default=[])
    args = parser.parse_args()

    target_dir = Path(args.target).resolve()
    base_urls = tuple(args.base_url) if args.base_url else DEFAULT_BASE_URLS
    print(f"target={target_dir}")

    for rel_path, expected in FILES.items():
        target = target_dir / rel_path
        if is_valid(target, expected):
            print(f"ok    {rel_path}")
            continue

        last_error = ""
        for url in candidate_urls(rel_path, base_urls):
            try:
                print(f"fetch {rel_path} <- {url}")
                download_once(url, target, expected)
                print(f"done  {rel_path}")
                last_error = ""
                break
            except Exception as exc:
                last_error = str(exc)
                print(f"fail  {rel_path}: {last_error}")
        if last_error:
            raise RuntimeError(f"failed to download {rel_path}: {last_error}")

    print("all ChatTTS assets are ready")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    raise SystemExit(main())
