# Tuberculosis Detection Demo

An experimental browser demo and FastAPI backend for one-class TBX11K
SymFormer inference. The app displays candidate detection boxes; it does not
classify an image as healthy or diagnose tuberculosis.

## Important limitations

This model performed poorly in validation and is for research/demo purposes
only. It must not be used for medical decisions, screening, or treatment.
Detection scores are not probabilities of disease, and no detections do not
mean an image is healthy.

## Project contents

- `backend/` contains the FastAPI API and browser frontend.
- `Tuberculosis-main/` contains the model configuration and required model
  source code. Its included `LICENSE.md` is
  CC BY-NC-SA 4.0; the source is for non-commercial use only.
- The trained checkpoint and datasets are intentionally not included.

## Run the demo

The model uses a legacy stack. Set up the Python 3.8, PyTorch 1.9,
torchvision 0.10, and MMCV-full 1.3.12 environment described in
`backend/README.md` before installing the API requirements.

Place the matching one-class `epoch_2.pth` checkpoint next to
`backend/app.py`, then from this project root run:

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000/> in a browser. See `backend/README.md` for
configuration, API details, and model limitations.
