"""
Face Detection Module - Using MediaPipe (v0.10+)
Handles face detection from webcam frames and returns bounding boxes.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
import os

try:
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    MEDIAPIPE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import MediaPipe ({e}).")
    MEDIAPIPE_AVAILABLE = False
    mp = None
    vision = None


class FaceDetector:
    """
    Face detection using MediaPipe Tasks API.
    MediaPipe is more efficient and accurate than Haar Cascade.
    """

    def __init__(self, min_detection_confidence: float = 0.5):
        """
        Initialize MediaPipe face detection.

        Args:
            min_detection_confidence: Minimum confidence threshold (0.0 to 1.0)
        """
        self.use_tasks_api = False
        self.detector = None

        if MEDIAPIPE_AVAILABLE:
            try:
                # Create FaceDetector using MediaPipe Tasks
                base_options = mp.tasks.BaseOptions(
                    model_asset_path=self._get_model_path()
                )
                options = vision.FaceDetectorOptions(
                    base_options=base_options,
                    min_detection_confidence=min_detection_confidence
                )
                self.detector = vision.FaceDetector.create_from_options(options)
                self.use_tasks_api = True
            except Exception as e:
                print(f"Warning: Could not load MediaPipe Tasks API: {e}")
                print("Falling back to Haar Cascade...")
        else:
            print("MediaPipe is unavailable. Falling back to Haar Cascade...")
            
        if not self.use_tasks_api:
            self.detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )

    def _get_model_path(self) -> str:
        """Get path to face detection model."""
        # Try to find the model in common locations
        model_name = "face_landmarker.task"
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "..", "models", model_name),
            os.path.expanduser(f"~/.cache/mediapipe/face_landmarker.task"),
            f"/tmp/{model_name}"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # If not found, return default - MediaPipe will handle it
        return model_name

    def detect_faces(
        self, 
        frame: np.ndarray
    ) -> Tuple[List[dict], np.ndarray]:
        """
        Detect faces in a frame.

        Args:
            frame: Input frame (BGR format from OpenCV)

        Returns:
            Tuple of (detections list, RGB frame)
            Each detection contains: 'bbox', 'confidence', 'face'
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_height, frame_width, _ = frame.shape
        detections = []

        if self.use_tasks_api:
            # Use MediaPipe Tasks API
            try:
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                results = self.detector.detect(image)
                
                if results and results.detections:
                    for detection in results.detections:
                        # Get bounding box from detection
                        bbox = detection.bounding_box
                        x_min = int(bbox.origin_x)
                        y_min = int(bbox.origin_y)
                        x_max = int(bbox.origin_x + bbox.width)
                        y_max = int(bbox.origin_y + bbox.height)
                        
                        # Ensure coordinates are within bounds
                        x_min = max(0, x_min)
                        y_min = max(0, y_min)
                        x_max = min(frame_width, x_max)
                        y_max = min(frame_height, y_max)
                        
                        # Crop face region
                        if x_max > x_min and y_max > y_min:
                            face_crop = frame[y_min:y_max, x_min:x_max].copy()
                            
                            detection_dict = {
                                'bbox': (x_min, y_min, x_max, y_max),
                                'confidence': detection.categories[0].score if detection.categories else 0.0,
                                'face': face_crop,
                                'center': ((x_min + x_max) // 2, (y_min + y_max) // 2)
                            }
                            detections.append(detection_dict)
            except Exception as e:
                print(f"MediaPipe detection error: {e}, falling back to Haar Cascade")
                self.use_tasks_api = False
        
        if not self.use_tasks_api:
            # Fallback to Haar Cascade
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Use stricter parameters to prevent false positives on random objects
            faces = self.detector.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=12,   # Increased to 12 to require extremely strong face confidence
                minSize=(80, 80)   # Increased to 80x80 to completely ignore small background objects
            )
            
            for (x, y, w, h) in faces:
                face_crop = frame[y:y+h, x:x+w].copy()
                
                detection_dict = {
                    'bbox': (x, y, x+w, y+h),
                    'confidence': 0.5,  # Default confidence for Haar Cascade
                    'face': face_crop,
                    'center': ((x + x + w) // 2, (y + y + h) // 2)
                }
                detections.append(detection_dict)

        return detections, rgb_frame

    def draw_detections(
        self, 
        frame: np.ndarray, 
        detections: List[dict],
        thickness: int = 2,
        color: Tuple[int, int, int] = (0, 255, 0)
    ) -> np.ndarray:
        """
        Draw bounding boxes on frame.

        Args:
            frame: Input frame
            detections: List of detection dictionaries
            thickness: Line thickness
            color: RGB color (B, G, R)

        Returns:
            Frame with drawn detections
        """
        annotated_frame = frame.copy()

        for detection in detections:
            x_min, y_min, x_max, y_max = detection['bbox']
            cv2.rectangle(
                annotated_frame,
                (x_min, y_min),
                (x_max, y_max),
                color,
                thickness
            )

        return annotated_frame

    def release(self):
        """Release MediaPipe resources."""
        if self.detector and self.use_tasks_api:
            try:
                self.detector.close()
            except:
                pass  # Ignore errors during cleanup

    def __del__(self):
        """Destructor to ensure resources are released."""
        try:
            self.release()
        except:
            pass


def resize_frame(frame: np.ndarray, max_width: int = 800) -> np.ndarray:
    """
    Resize frame for faster processing while maintaining aspect ratio.

    Args:
        frame: Input frame
        max_width: Maximum width (default 800 for better face detail and accuracy)

    Returns:
        Resized frame
    """
    height, width = frame.shape[:2]

    if width > max_width:
        scale = max_width / width
        new_height = int(height * scale)
        resized = cv2.resize(frame, (max_width, new_height))
        return resized

    return frame
