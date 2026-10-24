import io
import logging
import os
import sys
import tempfile
import threading
from pathlib import Path
from typing import List

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from torchvision.ops import nms


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PROJECT_ROOT / "Tuberculosis-main"
DEFAULT_CONFIG = (
    REPOSITORY_ROOT
    / "configs"
    / "symformer"
    / "symformer_retinanet_r50_oneclass_inference.py"
)

MODEL_CONFIG = Path(os.environ.get("MODEL_CONFIG", str(DEFAULT_CONFIG)))
MODEL_CHECKPOINT = Path(
    os.environ.get(
        "MODEL_CHECKPOINT",
        str(Path(__file__).resolve().parent / "epoch_2.pth"),
    )
)
MODEL_DEVICE = os.environ.get("MODEL_DEVICE", "cpu")
SCORE_THRESHOLD = float(os.environ.get("SCORE_THRESHOLD", "0.02"))
NMS_IOU_THRESHOLD = float(os.environ.get("NMS_IOU_THRESHOLD", "0.5"))
MAX_DETECTIONS = int(os.environ.get("MAX_DETECTIONS", "2"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MAX_IMAGE_DIMENSION = int(os.environ.get("MAX_IMAGE_DIMENSION", "8192"))

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("tbx11k.backend")

_model = None
_model_lock = threading.Lock()
_inference_lock = threading.Lock()


class Detection(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    score: float
    label: str = "TB"


class PredictionResponse(BaseModel):
    filename: str
    image_width: int
    image_height: int
    detections: List[Detection]
    model: str = "SymFormer TBX11K one-class experimental"
    disclaimer: str = (
        "Research demo only; not validated for diagnosis or clinical use."
    )


def _validate_settings() -> None:
    if not 0.0 <= SCORE_THRESHOLD <= 1.0:
        raise RuntimeError("SCORE_THRESHOLD must be between 0 and 1.")
    if not 0.0 < NMS_IOU_THRESHOLD <= 1.0:
        raise RuntimeError("NMS_IOU_THRESHOLD must be greater than 0 and at most 1.")
    if MAX_DETECTIONS < 1:
        raise RuntimeError("MAX_DETECTIONS must be at least 1.")
    if MAX_UPLOAD_BYTES < 1 or MAX_IMAGE_DIMENSION < 1:
        raise RuntimeError("Upload and image dimension limits must be positive.")
    if MODEL_DEVICE != "cpu" and not MODEL_DEVICE.startswith("cuda"):
        raise RuntimeError("MODEL_DEVICE must be 'cpu' or a CUDA device such as 'cuda:0'.")
    if MODEL_DEVICE.startswith("cuda") and not torch.cuda.is_available():
        raise RuntimeError("A CUDA device was requested but CUDA is unavailable.")


def _load_model():
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        _validate_settings()
        if not MODEL_CONFIG.is_file():
            raise FileNotFoundError(
                "Model config not found: {}. Set MODEL_CONFIG to the config "
                "used for the one-class checkpoint.".format(MODEL_CONFIG)
            )
        if not MODEL_CHECKPOINT.is_file():
            raise FileNotFoundError(
                "Model checkpoint not found: {}. Set MODEL_CHECKPOINT to the "
                "one-class epoch_2.pth file.".format(MODEL_CHECKPOINT)
            )

        sys.path.insert(0, str(REPOSITORY_ROOT))
        from mmdet.apis import init_detector

        try:
            _model = init_detector(
                str(MODEL_CONFIG),
                str(MODEL_CHECKPOINT),
                device=MODEL_DEVICE,
                cfg_options={
                    "model.test_cfg.score_thr": 0.001,
                    "model.test_cfg.max_per_img": 100,
                },
            )
        except Exception:
            logger.exception("Failed to initialize the SymFormer model.")
            raise

        _model.CLASSES = ("TB",)
        logger.info("Loaded SymFormer checkpoint on %s.", MODEL_DEVICE)
        return _model


def _decode_image(image_bytes: bytes):
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
            if width < 1 or height < 1:
                raise HTTPException(status_code=400, detail="Image has invalid dimensions.")
            if max(width, height) > MAX_IMAGE_DIMENSION:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions exceed the configured limit.",
                )
            image.load()
            rgb = np.asarray(image.convert("RGB"))
    except HTTPException:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a readable image.",
        ) from exc

    return rgb[:, :, ::-1].copy(), width, height


def _bbox_results(result):
    # This detector returns (bbox_results, auxiliary_classifier_scores).
    if isinstance(result, tuple):
        result = result[0]
    if not isinstance(result, (list, tuple)) or len(result) != 1:
        raise RuntimeError(
            "Expected one-class bbox results from the configured detector."
        )
    return np.asarray(result[0], dtype=np.float32).reshape(-1, 5)


def _predict(image):
    model = _load_model()
    from mmdet.apis import inference_detector

    # This detector accesses img_metas[0]["filename"] during inference, so
    # pass a temporary image path instead of an ndarray (which has no filename).
    with tempfile.TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "upload.png"
        Image.fromarray(image[:, :, ::-1].copy()).save(image_path, format="PNG")
        with _inference_lock:
            result = inference_detector(model, str(image_path))

    boxes = _bbox_results(result)
    if not len(boxes):
        return []

    finite = np.isfinite(boxes).all(axis=1)
    boxes = boxes[finite]
    if not len(boxes):
        return []

    boxes = boxes[boxes[:, 4] >= SCORE_THRESHOLD]
    if not len(boxes):
        return []

    kept = nms(
        torch.from_numpy(boxes[:, :4].copy()),
        torch.from_numpy(boxes[:, 4].copy()),
        NMS_IOU_THRESHOLD,
    ).cpu().numpy()
    boxes = boxes[kept]
    order = np.argsort(boxes[:, 4])[::-1][:MAX_DETECTIONS]

    return [
        Detection(
            x1=float(boxes[index, 0]),
            y1=float(boxes[index, 1]),
            x2=float(boxes[index, 2]),
            y2=float(boxes[index, 3]),
            score=float(boxes[index, 4]),
        )
        for index in order
    ]


app = FastAPI(
    title="SymFormer TBX11K Experimental Inference API",
    description=(
        "Research/demo inference only. This low-performing experimental model "
        "is not for medical or diagnostic use."
    ),
    version="0.1.0",
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "model_configured": MODEL_CONFIG.is_file() and MODEL_CHECKPOINT.is_file(),
        "device": MODEL_DEVICE,
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")

    image, width, height = _decode_image(image_bytes)
    try:
        detections = await run_in_threadpool(_predict, image)
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Model prediction failed.")
        raise HTTPException(
            status_code=500,
            detail="Model prediction failed. Check the backend logs.",
        ) from exc

    return PredictionResponse(
        filename=Path((file.filename or "upload").replace("\\", "/")).name,
        image_width=width,
        image_height=height,
        detections=detections,
    )
