_base_ = "./symformer_retinanet_r50_clean_phase1.py"

model = dict(
    train_cfg=dict(
        stage="detection",
        assigner=dict(
            type="MaxIoUAssigner",
            pos_iou_thr=0.5,
            neg_iou_thr=0.4,
            min_pos_iou=0,
            ignore_iof_thr=-1,
        ),
        allowed_border=-1,
        pos_weight=-1,
        debug=False,
    ),
    test_cfg=dict(
        stage="resnet_finetune",
        nms_pre=1000,
        min_bbox_size=0,
        score_thr=0.05,
        nms=dict(type="nms", iou_threshold=0.5),
        max_per_img=100,
    ),
)

optimizer = dict(stage="detection")
runner = dict(type="EpochBasedRunner", max_epochs=24)
checkpoint_config = dict(interval=2, max_keep_ckpts=3)
evaluation = dict(interval=1, metric="bbox")
work_dir = "work_dirs/symformer_retinanet_r50_clean_phase2"
load_from = "/content/drive/MyDrive/tb-colab/work_dirs/symformer_phase1/latest.pth"
resume_from = None
