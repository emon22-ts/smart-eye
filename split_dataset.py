import os
import shutil
import random

RAW_DIR = "dataset_raw"
OUT_DIR = "dataset"
SPLIT   = 0.80
SEED    = 42

CLASS_MAP = {
    "cataract":             "Cataract",
    "diabetic_retinopathy": "Diabetic_Retinopathy",
    "glaucoma":             "Glaucoma",
    "normal":               "Normal",
}

random.seed(SEED)

for raw_name, class_name in CLASS_MAP.items():
    src = os.path.join(RAW_DIR, raw_name)
    if not os.path.isdir(src):
        print(f"WARNING: {src} not found — skipping")
        continue

    images = [f for f in os.listdir(src)
              if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    random.shuffle(images)

    split_idx  = int(len(images) * SPLIT)
    train_imgs = images[:split_idx]
    val_imgs   = images[split_idx:]

    for split, imgs in [("train", train_imgs), ("validation", val_imgs)]:
        dest = os.path.join(OUT_DIR, split, class_name)
        os.makedirs(dest, exist_ok=True)
        for img in imgs:
            shutil.copy2(os.path.join(src, img), os.path.join(dest, img))

    print(f"  {class_name:25s}  train={len(train_imgs):4d}  validation={len(val_imgs):4d}")

print("\nDone — dataset/train and dataset/validation are ready")
