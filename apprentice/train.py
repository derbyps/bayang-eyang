"""Fine-tunes the apprentice dalang (Qwen3.5-4B, LoRA) on the teacher's clean plays with Tinker.

Usage (TINKER_API_KEY in ../.env):
    apprentice/.venv/bin/python apprentice/train.py [--epochs 3] [--dry-run]

--dry-run renders the dataset locally and prints the token count and estimated cost, without training.
"""

import argparse
import asyncio
import json
import os
from pathlib import Path

from tinker_cookbook import hyperparam_utils
from tinker_cookbook.renderers import TrainOnWhat
from tinker_cookbook.supervised import train
from tinker_cookbook.supervised.data import FromConversationFileBuilder
from tinker_cookbook.supervised.types import ChatDatasetBuilderCommonConfig

HERE = Path(__file__).parent
MODEL = "Qwen/Qwen3.5-4B"
# The app turns thinking off for every model, so the apprentice learns to answer directly.
RENDERER = "qwen3_5_disable_thinking"
TRAIN_PRICE_PER_M = 0.737  # USD per million training tokens, Qwen3.5-4B (Tinker pricing, Oct 2026)


def load_env() -> None:
    env = HERE.parent / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_env()

    common = ChatDatasetBuilderCommonConfig(
        model_name_for_tokenizer=MODEL,
        renderer_name=RENDERER,
        max_length=8192,
        batch_size=16,
        train_on_what=TrainOnWhat.LAST_ASSISTANT_MESSAGE,
    )
    dataset = FromConversationFileBuilder(common_config=common, file_path=str(HERE / "train.jsonl"), test_size=12)

    if args.dry_run:
        train_ds, _ = dataset()
        tokens = sum(len(d.model_input.to_ints()) for i in range(len(train_ds)) for d in train_ds.get_batch(i))
        total = tokens * args.epochs
        print(json.dumps({"batches": len(train_ds), "tokens_per_epoch": tokens, "epochs": args.epochs,
                          "estimated_usd": round(total / 1e6 * TRAIN_PRICE_PER_M, 2)}))
        return

    config = train.Config(
        log_path=str(HERE / "logs" / "apprentice"),
        model_name=MODEL,
        recipe_name="bayang-eyang-apprentice",
        renderer_name=RENDERER,
        dataset_builder=dataset,
        learning_rate=hyperparam_utils.get_lr(MODEL),
        num_epochs=args.epochs,
        lora_rank=32,
        save_every=20,
        eval_every=10,
    )
    asyncio.run(train.main(config))


if __name__ == "__main__":
    main()
