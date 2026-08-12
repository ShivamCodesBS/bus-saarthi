"""
Configuration File - Bus Management Attendance System
Customize system parameters here
"""

# ==================== FACE DETECTION SETTINGS ====================

# MediaPipe face detection confidence threshold (0.0 to 1.0)
FACE_DETECTION_CONFIDENCE = 0.7

# Minimum face area in pixels (smaller faces rejected)
MIN_FACE_AREA = 5000

# Frame resize width for faster processing (pixels)
# Lower = faster but less accurate
FRAME_MAX_WIDTH = 640

# ==================== FACE RECOGNITION SETTINGS ====================

# Face encoding distance threshold (lower = stricter)
# 0.3-0.4: Very strict (few false positives)
# 0.6: Default (balanced)
# 0.8-1.0: Lenient (more false positives)
FACE_DISTANCE_THRESHOLD = 0.6

# Recognition model: 'hog' (fast/CPU) or 'cnn' (slow/GPU)
RECOGNITION_MODEL = "hog"

# Number of times to re-sample face (higher = more accurate but slower)
RECOGNITION_NUM_JITTERS = 1

# ==================== REGISTRATION SETTINGS ====================

# Number of face frames to capture during registration
REGISTRATION_NUM_CAPTURES = 5

# Time interval between face captures (seconds)
REGISTRATION_CAPTURE_INTERVAL = 0.5

# ==================== ATTENDANCE SETTINGS ====================

# Time window to avoid duplicate check-ins (minutes)
DUPLICATE_ATTENDANCE_WINDOW = 5

# Session timeout (seconds)
RECOGNITION_SESSION_TIMEOUT = 600  # 10 minutes

# ==================== DATABASE SETTINGS ====================

# SQLite database path
DATABASE_PATH = "data/attendance.db"

# Enable database backup
ENABLE_BACKUP = True

# Backup directory
BACKUP_DIR = "data/backups"

# ==================== LOGGING SETTINGS ====================

# Log file path
LOG_FILE = "logs/system.log"

# Log level: DEBUG, INFO, WARNING, ERROR
LOG_LEVEL = "INFO"

# ==================== PERFORMANCE SETTINGS ====================

# FPS display refresh interval (frames)
FPS_DISPLAY_INTERVAL = 30

# Maximum concurrent webcam threads
MAX_CAMERA_THREADS = 1

# ==================== UI SETTINGS ====================

# GUI window width (pixels)
GUI_WINDOW_WIDTH = 800

# GUI window height (pixels)
GUI_WINDOW_HEIGHT = 600

# Enable fullscreen mode
GUI_FULLSCREEN = False

# Default theme
GUI_THEME = "default"

# ==================== RASPBERRY PI OPTIMIZATION ====================

# Enable Raspberry Pi optimizations (auto-detected)
# Set to True to force enable
RASPBERRYPI_MODE = False

# Reduced frame width for Raspberry Pi
RASPBERRYPI_FRAME_WIDTH = 480

# Raspberry Pi frame height
RASPBERRYPI_FRAME_HEIGHT = 360

# ==================== ADVANCED SETTINGS ====================

# Enable debug mode (verbose logging)
DEBUG_MODE = False

# Enable face landmark detection (future feature)
ENABLE_LANDMARKS = False

# Enable mask detection (future feature)
ENABLE_MASK_DETECTION = False

# Enable temperature check (future feature)
ENABLE_TEMPERATURE_CHECK = False

# GPIO pin for door control (Raspberry Pi)
GPIO_DOOR_PIN = 17

# Door open duration (seconds)
DOOR_OPEN_DURATION = 5

# ==================== ROUTE CONFIGURATION ====================
# Route ID that this vehicle/device is assigned to (e.g., "4")
ROUTE_ID = "4"

