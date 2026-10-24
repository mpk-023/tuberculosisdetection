_base_ = "./symformer_retinanet_r50_cls_fpn_1x_TBX11K.py"

data_root = "/content/cit-hack/data/tbx11k"
annotation_root = data_root + "/annotations/json/clean"
image_root = data_root + "/imgs"
classes = ("ActiveTuberculosis", "ObsoletePulmonaryTuberculosis")

model = dict(
    backbone=dict(
        init_cfg=dict(type="Pretrained", checkpoint="torchvision://resnet50")
    ),
    train_cfg=dict(stage="resnet_classify"),
    test_cfg=dict(stage="resnet_classify"),
)

img_norm_cfg = dict(
    mean=[123.675, 116.28, 103.53],
    std=[58.395, 57.12, 57.375],
    to_rgb=True,
)

train_pipeline = [
    dict(type="LoadImageFromFile"),
    dict(type="LoadAnnotations", with_bbox=True),
    dict(type="Resize", img_scale=(512, 512), keep_ratio=True),
    dict(type="RandomFlip", flip_ratio=0.5),
    dict(type="Normalize", **img_norm_cfg),
    dict(type="Pad", size_divisor=32),
    dict(type="DefaultFormatBundle"),
    dict(type="Collect", keys=["img", "gt_classes", "gt_bboxes", "gt_labels"]),
]

test_pipeline = [
    dict(type="LoadImageFromFile"),
    dict(
        type="MultiScaleFlipAug",
        img_scale=(512, 512),
        flip=False,
        transforms=[
            dict(type="Resize", keep_ratio=True),
            dict(type="RandomFlip"),
            dict(type="Normalize", **img_norm_cfg),
            dict(type="Pad", size_divisor=32),
            dict(type="ImageToTensor", keys=["img"]),
            dict(type="Collect", keys=["img"]),
        ],
    ),
]

data = dict(
    train=dict(
        type="CocoDataset",
        ann_file=annotation_root + "/train.json",
        img_prefix=image_root + "/",
        pipeline=train_pipeline,
        filter_empty_gt=False,
        classes=classes,
    ),
    val=dict(
        type="CocoDataset",
        ann_file=annotation_root + "/val.json",
        img_prefix=image_root + "/",
        pipeline=test_pipeline,
        classes=classes,
    ),
    test=dict(
        type="CocoDataset",
        ann_file=annotation_root + "/val.json",
        img_prefix=image_root + "/",
        pipeline=test_pipeline,
        classes=classes,
    ),
)

optimizer = dict(type="SGD", lr=0.000125, momentum=0.9, weight_decay=0.0001)
runner = dict(type="EpochBasedRunner", max_epochs=12)
checkpoint_config = dict(interval=1, max_keep_ckpts=3)
evaluation = dict(interval=99, metric="bbox")
work_dir = "work_dirs/symformer_retinanet_r50_clean_phase1"
load_from = None
resume_from = None
gpu_ids = range(0, 1)
