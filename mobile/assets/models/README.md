# ArcFace / MobileFaceNet Model

Place the `mobilefacenet.tflite` file in this directory.

## How to Get the Model

### Option 1: Download from InsightFace (Official)
1. Go to: https://github.com/deepinsight/insightface/tree/master/model_zoo
2. Download the MobileFaceNet model
3. Convert to TFLite format using the provided conversion scripts

### Option 2: Pre-converted TFLite Model
1. Search for "mobilefacenet tflite" on Google or GitHub
2. A commonly used version: https://github.com/sirius-ai/MobileFaceNet_TF
3. The model file should be approximately 5MB

## Model Specifications
- **Input**: 112×112×3 RGB image (float32, normalized to [-1, 1])
- **Output**: 192-dimensional embedding vector (float32)
- **Architecture**: MobileFaceNet (ArcFace loss)
- **Size**: ~5MB

## Verification
After placing the model, run the app. The console should print:
```
[ArcFace] Model loaded successfully
```
