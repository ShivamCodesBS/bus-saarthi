"""
Face Recognition Module - Using dlib ResNet directly
Handles face encoding generation and face matching.
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import dlib
import numpy as np
import math
from typing import Tuple, Optional, List
import face_recognition

# Load dlib models - global singletons
_DLIB_DETECTOR = dlib.get_frontal_face_detector()
_SHAPE_PREDICTOR = None
_DLIB_RECOGNIZER = None

def _get_shape_predictor():
    """Load shape predictor (lazy load)."""
    global _SHAPE_PREDICTOR
    if _SHAPE_PREDICTOR is None:
        try:
            import face_recognition_models
            model_path = face_recognition_models.pose_predictor_model_location()
            if os.path.exists(model_path):
                _SHAPE_PREDICTOR = dlib.shape_predictor(model_path)
            else:
                print(f"Warning: Shape predictor not found at {model_path}")
        except ImportError:
            print("Warning: face_recognition_models not installed")
    return _SHAPE_PREDICTOR

def _get_recognizer():
    """Load recognizer model (lazy load)."""
    global _DLIB_RECOGNIZER
    if _DLIB_RECOGNIZER is None:
        try:
            import face_recognition_models
            model_path = face_recognition_models.face_recognition_model_location()
            if os.path.exists(model_path):
                _DLIB_RECOGNIZER = dlib.face_recognition_model_v1(model_path)
            else:
                print(f"Warning: Recognizer model not found at {model_path}")
        except ImportError:
            print("Warning: face_recognition_models not installed")
    return _DLIB_RECOGNIZER


class FaceRecognizer:
    """
    Face recognition using dlib ResNet embeddings directly.
    Generates 128-dimensional face encodings for comparison.
    """

    def __init__(
        self,
        model: str = "hog",
        num_jitters: int = 1
    ):
        """
        Initialize face recognizer.

        Args:
            model: Model to use for face detection - 'hog' (faster, CPU) or 'cnn' (slower, GPU)
            num_jitters: Number of times to re-sample (1 = fast, higher = accurate)
        """
        self.detection_model = model
        self.num_jitters = num_jitters

    def get_face_encoding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face encoding from a face image using dlib directly.

        Args:
            face_image: Cropped face image (BGR format from OpenCV)

        Returns:
            128-dimensional encoding or None if no face detected
        """
        try:
            # Convert BGR to RGB and ensure it is contiguous in memory
            rgb_image = np.ascontiguousarray(face_image[:, :, ::-1])
            
            # Since face_image is already a cropped face, we tell face_recognition 
            # that the face occupies the entire image. Format: (top, right, bottom, left)
            h, w = rgb_image.shape[:2]
            locations = [(0, w, h, 0)]
            
            # This handles the 68-point landmarks and 150x150 face chipping automatically
            encodings = face_recognition.face_encodings(
                rgb_image, 
                known_face_locations=locations, 
                num_jitters=self.num_jitters
            )
            
            if encodings:
                return encodings[0]
                
            # Fallback: let face_recognition detect the face location itself if the explicit box failed
            encodings = face_recognition.face_encodings(rgb_image, num_jitters=self.num_jitters)
            if encodings:
                return encodings[0]
                
            return None

        except Exception as e:
            print(f"Error generating encoding: {e}")
            return None

    def get_eye_aspect_ratio(self, face_image: np.ndarray) -> Optional[float]:
        """
        Calculate the Eye Aspect Ratio (EAR) for blink detection.
        
        Args:
            face_image: Cropped face image (BGR format)
            
        Returns:
            Average EAR of both eyes, or None if eyes not detected
        """
        try:
            rgb_image = np.ascontiguousarray(face_image[:, :, ::-1])
            
            # Upscale image if it's too small to improve landmark precision for distant faces
            h, w = rgb_image.shape[:2]
            if h < 100 or w < 100:
                scale = max(100/h, 100/w)
                new_w, new_h = int(w * scale), int(h * scale)
                import cv2
                rgb_image = cv2.resize(rgb_image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
                
            h, w = rgb_image.shape[:2]
            locations = [(0, w, h, 0)]
            
            landmarks_list = face_recognition.face_landmarks(rgb_image, face_locations=locations)
            
            if not landmarks_list:
                # Fallback to auto-detection
                landmarks_list = face_recognition.face_landmarks(rgb_image)
                
            if not landmarks_list:
                return None
                
            landmarks = landmarks_list[0]
            
            if 'left_eye' not in landmarks or 'right_eye' not in landmarks:
                return None
                
            def calculate_ear(eye_points):
                # Compute the euclidean distances between the two sets of vertical eye landmarks
                A = math.dist(eye_points[1], eye_points[5])
                B = math.dist(eye_points[2], eye_points[4])
                # Compute the euclidean distance between the horizontal eye landmark
                C = math.dist(eye_points[0], eye_points[3])
                # EAR formula
                ear = (A + B) / (2.0 * C)
                return ear
                
            left_ear = calculate_ear(landmarks['left_eye'])
            right_ear = calculate_ear(landmarks['right_eye'])
            
            # Return the average EAR
            return (left_ear + right_ear) / 2.0
            
        except Exception as e:
            # Silently fail for EAR, just return None
            return None

    def compare_faces(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray],
        tolerance: float = 0.45
    ) -> List[bool]:
        """
        Compare a face encoding against multiple stored encodings.

        Args:
            encoding: Test face encoding
            stored_encodings: List of stored face encodings
            tolerance: How much distance to tolerate (0.45 = default, stricter to prevent false positives)

        Returns:
            List of boolean matches
        """
        return face_recognition.compare_faces(
            stored_encodings,
            encoding,
            tolerance=tolerance
        )

    def face_distance(
        self,
        encoding: np.ndarray,
        stored_encodings: List[np.ndarray]
    ) -> np.ndarray:
        """
        Calculate Euclidean distances between encoding and stored encodings.

        Args:
            encoding: Test face encoding
            stored_encodings: List of stored face encodings

        Returns:
            Array of distances (lower = more similar)
        """
        return face_recognition.face_distance(stored_encodings, encoding)

    def find_best_match(
        self,
        encoding: np.ndarray,
        stored_encodings: List[Tuple[np.ndarray, str]],
        tolerance: float = 0.45
    ) -> Tuple[Optional[str], float]:
        """
        Find best matching stored face.

        Args:
            encoding: Test face encoding
            stored_encodings: List of (encoding, passenger_id) tuples
            tolerance: Distance tolerance

        Returns:
            Tuple of (passenger_id, distance) or (None, 1.0) if no match
        """
        if not stored_encodings:
            return None, 1.0

        # Extract just encodings for comparison
        encodings_only = [enc[0] for enc in stored_encodings]

        # Calculate distances
        distances = self.face_distance(encoding, encodings_only)

        # Find minimum distance
        min_distance_idx = np.argmin(distances)
        min_distance = distances[min_distance_idx]

        # Check if within tolerance
        if min_distance <= tolerance:
            passenger_id = stored_encodings[min_distance_idx][1]
            return passenger_id, min_distance

        return None, min_distance

    def get_encoding_from_file(self, image_path: str) -> Optional[np.ndarray]:
        """
        Load image from file and get encoding using dlib.

        Args:
            image_path: Path to image file

        Returns:
            Face encoding or None
        """
        try:
            # Load image using dlib
            image = dlib.load_rgb_image(image_path)
            
            # Get recognizer
            recognizer = _get_recognizer()
            if recognizer is None:
                return None
            
            # Compute descriptor - let dlib auto-detect the face
            encoding = np.array(recognizer.compute_face_descriptor(image, self.num_jitters))
            
            return encoding

        except Exception as e:
            print(f"Error loading image: {e}")
            return None

    def batch_encode_faces(
        self,
        face_images: List[np.ndarray]
    ) -> List[Optional[np.ndarray]]:
        """
        Generate encodings for multiple face images.

        Args:
            face_images: List of face images

        Returns:
            List of encodings (None for failed encodings)
        """
        encodings = []
        for face_image in face_images:
            encoding = self.get_face_encoding(face_image)
            encodings.append(encoding)
        return encodings


def encode_embedding(embedding: np.ndarray) -> str:
    """
    Encode numpy array to string for database storage.

    Args:
        embedding: NumPy array (128-dimensional)

    Returns:
        Comma-separated string
    """
    return ",".join(map(str, embedding))


def decode_embedding(embedding_str: str) -> np.ndarray:
    """
    Decode string back to numpy array.

    Args:
        embedding_str: Comma-separated string

    Returns:
        NumPy array
    """
    return np.array([float(x) for x in embedding_str.split(",")])
