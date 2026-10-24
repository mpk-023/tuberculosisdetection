# SymFormer inference backend

This is a minimal HTTP API for the experimental one-class TBX11K SymFormer
checkpoint. It does not train the model. It is intended for a local research
demo, not clinical or diagnostic use.

## Model files

The checkpoint is not included in this project. Download the one-class
`epoch_2.pth` from Google Drive and place it next to `app.py`:

```text
backend/epoch_2.pth
```

Do not commit or publish the checkpoint file.

The default inference config is
`Tuberculosis-main/configs/symformer/symformer_retinanet_r50_oneclass_inference.py`.
If the training run saved its own one-class config, point `MODEL_CONFIG` to
that file instead; use the exact config that matches the checkpoint whenever
possible.

## Runtime

The model repository uses a legacy stack: Python 3.8, PyTorch 1.9.0,
torchvision 0.10.0, and MMCV-full 1.3.12. Install and validate that project
environment first, following the existing Colab notebook. Then install the
API requirements into the same environment:

```powershell
python -m pip install -r backend\requirements.txt
```

From the project root in PowerShell, set paths if the checkpoint or matching
config are elsewhere, then start the API:

```powershell
$env:MODEL_CHECKPOINT = "C:\path\to\epoch_2.pth"
$env:MODEL_CONFIG = "C:\path\to\oneclass_config.py"
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The default device is CPU. Set `MODEL_DEVICE` to `cuda:0` only when this
environment has a compatible CUDA-enabled PyTorch/MMCV installation.

Open `http://127.0.0.1:8000/` for the browser prototype, or
`http://127.0.0.1:8000/docs` for the inference API documentation. The browser
interface uses mock-only OTP, patient records, triage labels, scores,
observations, and heatmap illustrations; it does not call the trained model.
It stores demo records in browser local storage, not a secure clinical record
system. The separate `POST /predict` endpoint runs the experimental detector
and returns candidate boxes; it is not a validated triage service.
`GET /health` checks whether the config and checkpoint paths exist.
`POST /predict` accepts one image as multipart form field `file` and returns
original-image pixel coordinates, scores, and the `TB` label. The current preview-oriented defaults retain
scores of at least `0.02`, apply NMS IoU `0.5`, and return at most two boxes.
These settings reduce visual clutter; they do not improve model accuracy.
They can be changed with `SCORE_THRESHOLD`, `NMS_IOU_THRESHOLD`, and
`MAX_DETECTIONS`.

For a temporary public demo link using a compatible Colab GPU runtime, open
[`notebooks/run_public_demo_colab.ipynb`](../notebooks/run_public_demo_colab.ipynb)
in Colab and run the cells in order. Keep the notebook runtime running while
the link is in use. The tunnel is temporary and unauthenticated; do not upload
patient-identifiable or confidential images.

After frontend changes are pushed, interrupt the current tunnel cell, run the
notebook's **Refresh an already-running temporary demo** cell, then run the
tunnel cell again. A restarted quick tunnel may issue a different URL.

The checkpoint's validation performance was low (mAP 2.43%, AP@0.50 7.55% in
the reported one-class validation sweep). Predictions must not be used to
diagnose, screen, or guide treatment.
