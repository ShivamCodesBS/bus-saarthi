"""
Registration Module
Handles live face registration workflow through webcam.
"""

import cv2
import numpy as np
from typing import List, Tuple
import time
from modules.detection import FaceDetector, resize_frame
from modules.recognition import FaceRecognizer, encode_embedding


class LiveRegistration:
    """
    Live face registration workflow.
    Captures multiple face frames from webcam and stores embeddings.
    """

    def __init__(
        self,
        num_captures: int = 100,
        capture_interval: float = 0.5,
        min_face_area: int = 15000
    ):
        """
        Initialize registration system.

        Args:
            num_captures: Number of face frames to capture (default 100)
            capture_interval: Time between captures in seconds
            min_face_area: Minimum face area in pixels (to ensure quality)
        """
        self.num_captures = num_captures
        self.capture_interval = capture_interval
        self.min_face_area = min_face_area

        self.detector = FaceDetector(min_detection_confidence=0.7)
        self.recognizer = FaceRecognizer(model="hog", num_jitters=100)

    def capture_faces(
        self,
        camera_id: int = 0,
        timeout: float = 600.0
    ) -> Tuple[List[np.ndarray], bool]:
        """
        Capture multiple face frames from webcam.

        Args:
            camera_id: Webcam camera index (default 0)
            timeout: Maximum time to wait for captures (seconds)

        Returns:
            Tuple of (face_images list, success boolean)
        """
        cap = cv2.VideoCapture(camera_id)

        if not cap.isOpened():
            print("Error: Cannot open webcam")
            return [], False

        captured_faces = []
        start_time = time.time()
        last_capture_time = 0

        print(f"Capturing {self.num_captures} face frames...")
        print("Move your face around for better angle coverage")

        try:
            while len(captured_faces) < self.num_captures:
                ret, frame = cap.read()

                if not ret:
                    print("Error reading frame")
                    break

                # Resize for faster processing, but preserve enough detail for accuracy
                frame = resize_frame(frame, max_width=800)

                # Detect faces
                detections, _ = self.detector.detect_faces(frame)

                # Display instructions
                display_frame = frame.copy()
                status_text = f"Captured: {len(captured_faces)}/{self.num_captures}"
                cv2.putText(
                    display_frame,
                    status_text,
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (0, 255, 0),
                    2
                )

                if detections:
                    # Draw detected faces
                    for detection in detections:
                        x_min, y_min, x_max, y_max = detection['bbox']
                        face_area = (x_max - x_min) * (y_max - y_min)

                        # Check if face area is sufficient
                        if face_area < self.min_face_area:
                            color = (0, 0, 255)  # Red - too small
                            text = "Face too small"
                        else:
                            color = (0, 255, 0)  # Green - good

                        cv2.rectangle(display_frame, (x_min, y_min), (x_max, y_max), color, 2)

                    # Capture largest face at interval
                    current_time = time.time()
                    if current_time - last_capture_time >= self.capture_interval:
                        # Get largest face
                        largest_detection = max(
                            detections,
                            key=lambda d: (d['bbox'][2] - d['bbox'][0]) * (d['bbox'][3] - d['bbox'][1])
                        )

                        face_area = ((largest_detection['bbox'][2] - largest_detection['bbox'][0]) *
                                    (largest_detection['bbox'][3] - largest_detection['bbox'][1]))

                        if face_area >= self.min_face_area:
                            captured_faces.append(largest_detection['face'].copy())
                            last_capture_time = current_time
                            print(f"  - Captured frame {len(captured_faces)}/{self.num_captures}")

                else:
                    text = "No face detected"
                    cv2.putText(
                        display_frame,
                        text,
                        (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 0, 255),
                        2
                    )

                # Display frame
                cv2.imshow("Face Registration - Capturing Faces", display_frame)

                # Check timeout
                if time.time() - start_time > timeout:
                    print("Timeout: Could not capture all faces")
                    break

                # Press 'q' to cancel, 's' to skip/accelerate
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("Registration cancelled by user")
                    captured_faces = []
                    break
                elif key == ord('s'):
                    # Reduce interval for faster capture
                    self.capture_interval = max(0.1, self.capture_interval - 0.1)

        except Exception as e:
            print(f"Error during capture: {e}")
            captured_faces = []

        finally:
            cap.release()
            cv2.destroyAllWindows()

        success = len(captured_faces) == self.num_captures
        return captured_faces, success

    def generate_encodings(
        self,
        face_images: List[np.ndarray]
    ) -> List[Tuple[np.ndarray, float]]:
        """
        Generate face encodings from captured images.

        Args:
            face_images: List of face images

        Returns:
            List of (encoding, quality_score) tuples
        """
        encodings = []

        print(f"Generating {len(face_images)} face encodings...")

        for i, face_image in enumerate(face_images):
            try:
                encoding = self.recognizer.get_face_encoding(face_image)

                if encoding is not None:
                    # Simple quality score based on encoding magnitude
                    quality = np.linalg.norm(encoding) / 128.0  # Normalize by dimension
                    encodings.append((encoding, quality))
                    print(f"  - Encoding {i+1}/{len(face_images)}: Generated")
                else:
                    print(f"  - Encoding {i+1}/{len(face_images)}: Failed to extract face")

            except Exception as e:
                print(f"  - Encoding {i+1}/{len(face_images)}: Error - {e}")

        return encodings

    def average_encoding(self, encodings: List[np.ndarray]) -> np.ndarray:
        """
        Average multiple face encodings for more robust matching.

        Args:
            encodings: List of face encodings

        Returns:
            Averaged encoding
        """
        if len(encodings) == 0:
            raise ValueError("No encodings provided")

        return np.mean(encodings, axis=0)

    def select_best_encodings(
        self,
        encoding_scores: List[Tuple[np.ndarray, float]],
        num_select: int = None
    ) -> List[np.ndarray]:
        """
        Select best quality encodings.

        Args:
            encoding_scores: List of (encoding, quality_score) tuples
            num_select: Number to select (default all)

        Returns:
            List of selected encodings
        """
        if num_select is None:
            num_select = len(encoding_scores)

        # Sort by quality score (descending)
        sorted_scores = sorted(encoding_scores, key=lambda x: x[1], reverse=True)

        # Select top encodings
        selected = [enc for enc, _ in sorted_scores[:num_select]]

        return selected

    def register_passenger_interactive(
        self,
        database,
        camera_id: int = 0
    ) -> bool:
        """
        Interactive passenger registration workflow.

        Args:
            database: Database instance
            camera_id: Webcam index

        Returns:
            True if registration successful
        """
        print("\n" + "="*50)
        print("PASSENGER REGISTRATION")
        print("="*50)

        # Get passenger information
        try:
            name = input("Enter passenger name: ").strip()
            if not name:
                print("Name cannot be empty")
                return False

            passenger_id = input("Enter passenger ID: ").strip()
            if not passenger_id:
                print("Passenger ID cannot be empty")
                return False

            fee_status = input("Enter fee status (paid/unpaid) [default: unpaid]: ").strip().lower()
            if fee_status not in ['paid', 'unpaid']:
                fee_status = 'unpaid'

            phone = input("Enter phone (optional): ").strip()
            email = input("Enter email (optional): ").strip()

        except KeyboardInterrupt:
            print("\nRegistration cancelled")
            return False

        # Capture faces
        face_images, capture_success = self.capture_faces(camera_id=camera_id)

        if not capture_success:
            print(f"Failed to capture {self.num_captures} face images")
            return False

        # Generate encodings
        encoding_scores = self.generate_encodings(face_images)

        if len(encoding_scores) == 0:
            print("Failed to generate encodings from captured faces")
            return False

        # Select best encodings
        best_encodings = self.select_best_encodings(encoding_scores, num_select=max(1, len(encoding_scores)))

        # Average them for more robust matching
        avg_encoding = self.average_encoding(best_encodings)

        # Register in database
        db_success = database.register_passenger(
            passenger_id=passenger_id,
            name=name,
            fee_status=fee_status,
            phone=phone,
            email=email
        )

        if not db_success:
            print("Failed to register passenger in database")
            return False

        # Store encodings
        num_stored = 0
        for encoding, quality in encoding_scores:
            embedding_str = encode_embedding(encoding)
            if database.store_embedding(passenger_id, embedding_str, quality):
                num_stored += 1
                
                # Add to sync queue
                database.add_to_sync_queue(
                    data_type='encoding',
                    payload={
                        'passenger_id': passenger_id,
                        'embedding': embedding_str,
                        'quality_score': quality
                    }
                )

        # Store averaged encoding with higher priority
        avg_embedding_str = encode_embedding(avg_encoding)
        if database.store_embedding(passenger_id, avg_embedding_str, 1.0):  # Quality 1.0 for average
            database.add_to_sync_queue(
                data_type='encoding',
                payload={
                    'passenger_id': passenger_id,
                    'embedding': avg_embedding_str,
                    'quality_score': 1.0
                }
            )

        print("\n" + "="*50)
        print("REGISTRATION SUCCESSFUL!")
        print("="*50)
        print(f"Name: {name}")
        print(f"Passenger ID: {passenger_id}")
        print(f"Fee Status: {fee_status}")
        print(f"Encodings stored: {num_stored + 1}")
        print("="*50 + "\n")

        return True

    def release(self):
        """Release resources."""
        self.detector.release()

    def __del__(self):
        """Destructor."""
        self.release()
