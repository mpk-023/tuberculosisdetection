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

## Temporary public demo

[![Open the public-demo Colab notebook](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mpk-023/tuberculosisdetection/blob/main/notebooks/run_public_demo_colab.ipynb)

Open the notebook, choose a GPU runtime, then run its cells from top to
bottom. It installs the compatible legacy inference stack, mounts Google
Drive to read the checkpoint at
`MyDrive/tb-colab/symformer_oneclass_full_2ep/epoch_2.pth`, starts the API,
and opens a temporary public URL through Cloudflare Tunnel. The checkpoint
must be placed in that Drive folder first; it is not included in GitHub.

The public link works only while the Colab runtime and tunnel remain running.
It is temporary, unauthenticated, and intended for a research demo only.
Anyone with the URL can reach the upload page; do not upload patient-identifiable
or confidential images. For local setup, API configuration, and limitations,
see `backend/README.md`.
