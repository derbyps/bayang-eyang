"""Brings the apprentice home: downloads the final LoRA weights from Tinker and merges them into Qwen3.5-4B.

Usage (after train.py):
    apprentice/.venv/bin/python apprentice/export.py

Writes apprentice/weights/adapter (the LoRA, a few hundred MB) and apprentice/weights/merged (a full HF model
that Ollama or llama.cpp can import).
"""

from pathlib import Path

from tinker_cookbook import checkpoint_utils, weights

from train import HERE, MODEL, load_env


def main() -> None:
    load_env()
    record = checkpoint_utils.get_last_checkpoint(str(HERE / "logs" / "apprentice"), required_key="state_path")
    if record is None or record.state_path is None:
        raise SystemExit("No training checkpoint found; run train.py first.")
    print(f"checkpoint {record.name}: {record.state_path}")

    out = HERE / "weights"
    adapter = out / "adapter"
    if not adapter.exists():
        weights.download(tinker_path=record.state_path, output_dir=str(adapter))
    merged = out / "merged"
    if not merged.exists():
        weights.build_hf_model(base_model=MODEL, adapter_path=str(adapter), output_path=str(merged))
    print(f"merged model: {merged}")


if __name__ == "__main__":
    main()
