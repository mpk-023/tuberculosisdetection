_base_ = "./symformer_retinanet_r50_clean_phase2.py"

classes = ("TB",)

model = dict(
    bbox_head=dict(num_classes=1),
    test_cfg=dict(
        score_thr=0.001,
        nms=dict(type="nms", iou_threshold=0.5),
        max_per_img=100,
    ),
)

data = dict(test=dict(classes=classes))
