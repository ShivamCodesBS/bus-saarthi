"""
API DOCUMENTATION - Bus Management Face Recognition System
Comprehensive guide for developers and integrations
"""

# ============================================================================
#                          API DOCUMENTATION
#                   Bus Management Attendance System
# ============================================================================

# =========================== MODULES OVERVIEW ==============================

"""
1. DETECTION MODULE (modules/detection.py)
   Purpose: MediaPipe-based face detection
   Classes: FaceDetector
   Functions: resize_frame()
   
   Usage:
       from modules.detection import FaceDetector
       detector = FaceDetector(min_detection_confidence=0.7)
       detections, rgb_frame = detector.detect_faces(frame)
       annotated = detector.draw_detections(frame, detections)
"""

# =========================== DETECTION MODULE API ============================

class FaceDetector:
    """
    Face detection using MediaPipe.
    
    Attributes:
        mp_face_detection: MediaPipe face detection object
        detector: Initialized detector instance
        
    Methods:
        __init__(min_detection_confidence=0.5)
            Initialize face detector
            Args: min_detection_confidence (float) - Confidence threshold
            
        detect_faces(frame) -> Tuple[List[dict], np.ndarray]
            Detect faces in frame
            Returns: (detections, rgb_frame)
            
        draw_detections(frame, detections, thickness=2, color=(0,255,0)) -> np.ndarray
            Draw bounding boxes on frame
            Returns: Annotated frame
            
        release()
            Release MediaPipe resources
    
    Detection Output Format:
        Each detection is a dictionary:
        {
            'bbox': (x_min, y_min, x_max, y_max),  # Pixel coordinates
            'confidence': float,                     # 0.0 to 1.0
            'face': np.ndarray,                     # Cropped face BGR image
            'center': (x_center, y_center)          # Face center coordinates
        }
    
    Example:
        detector = FaceDetector(min_detection_confidence=0.7)
        detections, _ = detector.detect_faces(frame)
        for detection in detections:
            print(f"Face at {detection['bbox']}")
            face_image = detection['face']
"""

# =========================== RECOGNITION MODULE API =========================

"""
2. RECOGNITION MODULE (modules/recognition.py)
   Purpose: Face encoding and matching using face_recognition (dlib)
   Classes: FaceRecognizer
   Functions: encode_embedding(), decode_embedding()
   
   Usage:
       from modules.recognition import FaceRecognizer, encode_embedding
       recognizer = FaceRecognizer(model="hog", num_jitters=1)
       encoding = recognizer.get_face_encoding(face_image)
       encoded_str = encode_embedding(encoding)
"""

class FaceRecognizer:
    """
    Face recognition using face_recognition library (dlib ResNet).
    
    Attributes:
        model: Detection model ('hog' or 'cnn')
        num_jitters: Re-sampling iterations for accuracy
        
    Methods:
        __init__(model="hog", num_jitters=1)
            Initialize recognizer
            Args:
                model - "hog" (fast) or "cnn" (accurate)
                num_jitters - 1 (fast) to 5+ (accurate)
                
        get_face_encoding(face_image) -> Optional[np.ndarray]
            Generate 128-D encoding from face image
            Args: face_image (BGR numpy array)
            Returns: 128-D numpy array or None
            
        compare_faces(encoding, stored_encodings, tolerance=0.6) -> List[bool]
            Compare encoding against multiple stored encodings
            Returns: List of boolean matches
            
        face_distance(encoding, stored_encodings) -> np.ndarray
            Calculate Euclidean distances
            Returns: Array of distances (lower = more similar)
            
        find_best_match(encoding, stored_encodings, tolerance=0.6) -> Tuple
            Find best matching student
            Returns: (student_id, distance)
            
        batch_encode_faces(face_images) -> List[Optional[np.ndarray]]
            Encode multiple faces
            Returns: List of encodings
    
    Face Encoding:
        - 128-dimensional numpy array
        - Represents unique face characteristics
        - Can be averaged for multiple captures
        - Compared using Euclidean distance
    
    Example:
        recognizer = FaceRecognizer(model="hog")
        encoding = recognizer.get_face_encoding(face_image)
        if encoding is not None:
            student_id, distance = recognizer.find_best_match(
                encoding,
                stored_encodings_list,
                tolerance=0.6
            )
"""

# =========================== DATABASE MODULE API =============================

"""
3. DATABASE MODULE (modules/database.py)
   Purpose: SQLite database operations
   Classes: AttendanceDatabase
   
   Usage:
       from modules.database import AttendanceDatabase
       db = AttendanceDatabase("data/attendance.db")
       db.register_student("S001", "John Doe", "paid")
"""

class AttendanceDatabase:
    """
    SQLite database for attendance system.
    
    Tables:
        - students
        - embeddings
        - attendance
    
    Methods:
        
        # STUDENT OPERATIONS
        ─────────────────────
        register_student(student_id, name, fee_status="unpaid", 
                        phone="", email="") -> bool
            Register new student
            
        get_student(student_id) -> Optional[Dict]
            Get student details
            
        update_fee_status(student_id, fee_status) -> bool
            Update fee status ('paid' or 'unpaid')
            
        get_all_students() -> List[Dict]
            Retrieve all students
        
        # EMBEDDING OPERATIONS
        ──────────────────────
        store_embedding(student_id, embedding_str, quality_score=0.0) -> bool
            Store face encoding
            
        get_embeddings(student_id) -> List[str]
            Get all embeddings for student
            
        get_all_embeddings() -> List[Tuple[str, str]]
            Get all embeddings (student_id, embedding_str)
        
        # ATTENDANCE OPERATIONS
        ───────────────────────
        log_attendance(student_id, name, fee_status, 
                      confidence=0.0, device_id="desktop") -> bool
            Log attendance record
            
        check_duplicate_attendance(student_id, time_window_minutes=5) -> bool
            Check if student recently checked in
            
        get_attendance_records(student_id=None, date_from=None, 
                             date_to=None, limit=100) -> List[Dict]
            Retrieve attendance records with filters
            
        get_today_attendance() -> List[Dict]
            Get today's attendance
            
        get_statistics() -> Dict
            Get system statistics
        
        # UTILITY OPERATIONS
        ────────────────────
        export_attendance_csv(output_path) -> bool
            Export to CSV file
            
        close()
            Close database connection
    
    Database Schema:
        
        students:
            - student_id (PRIMARY KEY)
            - name
            - fee_status
            - registration_date
            - phone
            - email
        
        embeddings:
            - embedding_id (PRIMARY KEY)
            - student_id (FOREIGN KEY)
            - embedding (TEXT - comma-separated 128-D values)
            - capture_date
            - quality_score
        
        attendance:
            - attendance_id (PRIMARY KEY)
            - student_id (FOREIGN KEY)
            - name
            - check_in_time
            - fee_status
            - confidence
            - device_id
    
    Example:
        db = AttendanceDatabase()
        
        # Register student
        db.register_student("S001", "Alice", "paid", "555-1234")
        
        # Store embedding
        from modules.recognition import encode_embedding
        embedding_str = encode_embedding(encoding_array)
        db.store_embedding("S001", embedding_str, quality=0.95)
        
        # Log attendance
        db.log_attendance("S001", "Alice", "paid", confidence=0.89)
        
        # Query attendance
        records = db.get_attendance_records(student_id="S001")
        
        db.close()
"""

# =========================== REGISTRATION MODULE API ==========================

"""
4. REGISTRATION MODULE (modules/registration.py)
   Purpose: Live face registration workflow
   Classes: LiveRegistration
   
   Usage:
       from modules.registration import LiveRegistration
       registration = LiveRegistration(num_captures=5)
       faces, success = registration.capture_faces()
"""

class LiveRegistration:
    """
    Live face registration from webcam.
    
    Methods:
        capture_faces(camera_id=0, timeout=60.0) -> Tuple[List, bool]
            Capture face frames from webcam
            Returns: (face_images, success)
            
        generate_encodings(face_images) -> List[Tuple[np.ndarray, float]]
            Generate encodings from captured faces
            Returns: List of (encoding, quality_score)
            
        average_encoding(encodings) -> np.ndarray
            Average multiple encodings for robustness
            
        select_best_encodings(encoding_scores, num_select=None) -> List
            Select top quality encodings
            
        register_student_interactive(database, camera_id=0) -> bool
            Full interactive registration workflow
    
    Workflow:
        1. User enters: name, student_id, fee_status
        2. capture_faces() opens webcam
        3. Captures 5 frames at intervals
        4. generate_encodings() creates 128-D vectors
        5. Stores all encodings + averaged encoding
        6. Registration complete
    
    Example:
        registration = LiveRegistration(num_captures=5)
        success = registration.register_student_interactive(db)
"""

# =========================== ATTENDANCE MODULE API =============================

"""
5. ATTENDANCE MODULE (modules/attendance.py)
   Purpose: Real-time face recognition and attendance logging
   Classes: RealtimeAttendance
   
   Usage:
       from modules.attendance import RealtimeAttendance
       attendance = RealtimeAttendance(confidence_threshold=0.6)
       attendance.start_recognition(db, camera_id=0)
"""

class RealtimeAttendance:
    """
    Real-time face recognition and attendance system.
    
    Methods:
        update_embeddings_cache(database) -> int
            Load all embeddings into memory cache
            Returns: Number of embeddings loaded
            
        recognize_face(face_image, database) -> Tuple[Optional[Dict], float]
            Recognize single face
            Returns: (student_info, confidence)
            
        start_recognition(database, camera_id=0, timeout_seconds=300)
            Start real-time recognition from webcam
            Automatic attendance logging
            
    Visual Output:
        - GREEN BOX: Student recognized + fee paid ✓
        - RED BOX: Student recognized + fee unpaid ✗
        - BLUE BOX: Face unknown
        - Confidence score displayed
        - FPS counter
        
    Automatic Actions:
        - Detects faces continuously
        - Matches against stored encodings
        - Logs attendance (once per time window)
        - Updates UI with match confidence
        - Tracks recognized faces to avoid duplicates
    
    Example:
        attendance = RealtimeAttendance(confidence_threshold=0.6)
        attendance.update_embeddings_cache(db)  # Optional, auto-called
        attendance.start_recognition(db, camera_id=0, timeout_seconds=600)
"""

# =========================== UTILITY MODULE API ================================

"""
6. UTILITY MODULE (modules/utils.py)
   Purpose: Helper functions and logging
   Functions: Various utility functions
   
   Usage:
       from modules.utils import log_message, create_directories
       log_message("Application started")
       create_directories()
"""

# =========================== GUI MODULE API ====================================

"""
7. UI MODULE (ui/main_ui.py)
   Purpose: Tkinter GUI interface
   Classes: AttendanceSystemGUI
   
   Usage:
       from ui.main_ui import AttendanceSystemGUI
       import tkinter as tk
       root = tk.Tk()
       gui = AttendanceSystemGUI(root)
       root.mainloop()
"""

# =========================== INTEGRATION EXAMPLES =============================

"""
EXAMPLE 1: Simple Face Detection
──────────────────────────────────

    import cv2
    from modules.detection import FaceDetector
    
    cap = cv2.VideoCapture(0)
    detector = FaceDetector(min_detection_confidence=0.7)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Detect faces
        detections, _ = detector.detect_faces(frame)
        
        # Draw boxes
        frame = detector.draw_detections(frame, detections)
        
        cv2.imshow("Face Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    detector.release()


EXAMPLE 2: Face Recognition Pipeline
──────────────────────────────────────

    from modules.detection import FaceDetector
    from modules.recognition import FaceRecognizer, encode_embedding, decode_embedding
    from modules.database import AttendanceDatabase
    
    # Initialize
    detector = FaceDetector()
    recognizer = FaceRecognizer(model="hog")
    db = AttendanceDatabase()
    
    # Detect and encode
    detections, _ = detector.detect_faces(frame)
    for detection in detections:
        face_image = detection['face']
        
        # Generate encoding
        encoding = recognizer.get_face_encoding(face_image)
        if encoding is None:
            continue
        
        # Get all stored embeddings
        all_embeddings_data = db.get_all_embeddings()
        stored_embeddings = [
            (decode_embedding(e[1]), e[0]) for e in all_embeddings_data
        ]
        
        # Find best match
        student_id, distance = recognizer.find_best_match(
            encoding,
            stored_embeddings,
            tolerance=0.6
        )
        
        if student_id:
            student = db.get_student(student_id)
            print(f"Recognized: {student['name']}")
            print(f"Fee Status: {student['fee_status']}")
            print(f"Confidence: {distance}")


EXAMPLE 3: Custom Registration
────────────────────────────────

    from modules.registration import LiveRegistration
    from modules.database import AttendanceDatabase
    from modules.recognition import encode_embedding
    
    db = AttendanceDatabase()
    registration = LiveRegistration(num_captures=8)  # More captures
    
    # Capture faces
    faces, success = registration.capture_faces(timeout=120)
    
    if success:
        # Generate encodings
        encodings = registration.generate_encodings(faces)
        
        # Store student
        db.register_student("S001", "John", "paid")
        
        # Store all encodings
        for encoding, quality in encodings:
            embedding_str = encode_embedding(encoding)
            db.store_embedding("S001", embedding_str, quality)
        
        print("Registration complete!")
    
    db.close()


EXAMPLE 4: Batch Processing
──────────────────────────────

    from modules.recognition import FaceRecognizer
    
    recognizer = FaceRecognizer()
    
    # Get multiple faces
    face_images = [...]  # List of face numpy arrays
    
    # Batch encode
    encodings = recognizer.batch_encode_faces(face_images)
    
    # Filter valid encodings
    valid_encodings = [e for e in encodings if e is not None]
    
    print(f"Successfully encoded: {len(valid_encodings)}/{len(face_images)}")
"""

# =========================== CONFIGURATION ======================================

"""
Configuration via config.py:

    FACE_DETECTION_CONFIDENCE = 0.7
    FACE_DISTANCE_THRESHOLD = 0.6
    REGISTRATION_NUM_CAPTURES = 5
    RECOGNITION_MODEL = "hog"
    DUPLICATE_ATTENDANCE_WINDOW = 5
    DATABASE_PATH = "data/attendance.db"
"""

# =========================== ERROR HANDLING ====================================

"""
Common Errors and Solutions:

1. cv2.error: Camera access denied
   Solution: Check camera permissions, restart application

2. face_recognition.CLusterError: dlib compilation failed
   Solution: pip install --no-build-isolation face-recognition

3. sqlite3.OperationalError: database is locked
   Solution: Close other connections to database

4. No faces detected in registration
   Solution: Better lighting, face must be visible, close to camera

5. Low recognition accuracy
   Solution: Increase REGISTRATION_NUM_CAPTURES, improve lighting
"""

# =========================== PERFORMANCE OPTIMIZATION ===========================

"""
For Faster Processing:

1. Reduce frame resolution (config.py):
   FRAME_MAX_WIDTH = 480  # From 640

2. Use HOG model (faster than CNN):
   recognizer = FaceRecognizer(model="hog")

3. Reduce jitters (faster but less accurate):
   recognizer = FaceRecognizer(num_jitters=1)

4. Limit stored embeddings:
   Store only best encoding per student

5. Raspberry Pi specific:
   - Use RASPBERRYPI_MODE in config.py
   - Reduce resolution further
   - Limit concurrent operations
"""

# =========================== FUTURE EXTENSIONS ==================================

"""
Planned Features:

1. Liveness detection (detect photo attacks)
   - Use face landmarks from MediaPipe
   - Analyze expression changes

2. Mask detection
   - Add mask classification model
   - Flag employees without masks

3. Temperature integration
   - Add thermal camera input
   - Log temperature with attendance

4. GPIO control
   - Raspberry Pi GPIO for door lock
   - Relay control for gate

5. Mobile app sync
   - Optional cloud sync
   - Mobile app attendance view

6. Multi-camera support
   - Multiple camera streams
   - Unified database

7. Advanced analytics
   - Heatmaps of attendance
   - Pattern analysis
   - Reports and dashboards
"""

# =========================== DEPLOYMENT =========================================

"""
Docker Deployment (Future):

FROM python:3.9
RUN apt-get update && apt-get install -y \\
    libsm6 libxext6 libxrender-dev \\
    libopenblas-dev liblapack-dev
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python3", "main.py"]

Kubernetes deployment (Future):
- Multi-pod scaling
- Load balancing
- Database replication
"""

# =========================== END OF DOCUMENTATION ============================

if __name__ == "__main__":
    print(__doc__)
