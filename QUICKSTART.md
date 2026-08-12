"""
Quick Start Guide - Bus Management System
Complete step-by-step usage instructions
"""

print("""
╔═══════════════════════════════════════════════════════════════╗
║     BUS MANAGEMENT - FACE RECOGNITION ATTENDANCE SYSTEM      ║
║                     QUICK START GUIDE                         ║
╚═══════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════

STEP 1: INSTALLATION
─────────────────────────────────────────────────────────────────

1. Clone the repository:
   cd ~/Desktop/Github/Bus-Management

2. Create virtual environment:
   python3 -m venv venv
   source venv/bin/activate

3. Install dependencies:
   pip install -r requirements.txt

4. Initialize system:
   python3 main.py --setup

═══════════════════════════════════════════════════════════════════

STEP 2: FIRST RUN - REGISTER A PASSENGER
─────────────────────────────────────────────────────────────────

Option A: Using GUI (Recommended)
    python3 main.py
    → Click "Register Passenger" tab
    → Fill in passenger details
    → Click "Start Registration"
    → Webcam opens - capture face from 5 angles
    → Move head left, right, up, down
    → System stores face encodings

Option B: Using CLI
    python3 main.py --register
    → Enter passenger details when prompted
    → Follow webcam instructions

═══════════════════════════════════════════════════════════════════

STEP 3: START RECOGNITION
─────────────────────────────────────────────────────────────────

Option A: Using GUI
    python3 main.py
    → Click "Recognition" tab
    → Set confidence threshold (0.6 recommended)
    → Click "Start Recognition"
    → Webcam shows live feed
    → GREEN BOX = Paid (Access granted)
    → RED BOX = Unpaid (Fees pending)
    → BLUE BOX = Unknown face
    → Press 'q' to exit

Option B: Using CLI
    python3 main.py --recognize
    → Webcam starts automatically
    → Press 'q' to exit

═══════════════════════════════════════════════════════════════════

STEP 4: VIEW ATTENDANCE RECORDS
─────────────────────────────────────────────────────────────────

Option A: Using GUI
    python3 main.py
    → Click "View Attendance" tab
    → Optionally filter by passenger ID
    → Click "Refresh"
    → Can export to CSV

Option B: Using CLI
    python3 main.py --cli
    → Select option 3 for all attendance
    → Select option 4 for today's attendance

═══════════════════════════════════════════════════════════════════

IMPORTANT FEATURES EXPLAINED
─────────────────────────────────────────────────────────────────

Face Recognition Accuracy:
  • GREEN BOX: Passenger recognized AND fee status is "paid"
              → ACCESS GRANTED
  
  • RED BOX: Passenger recognized BUT fee status is "unpaid"
            → FEES PENDING (Access denied)
  
  • BLUE BOX: Face not recognized as any registered passenger
             → UNKNOWN FACE

Confidence Threshold:
  • Lower threshold (0.3-0.4): Accepts similar faces (may be wrong)
  • Default (0.6): Balanced - recommended
  • Higher (0.8-1.0): Only exact matches (may reject valid faces)

Duplicate Prevention:
  • System avoids logging same person twice within 5 minutes
  • Prevents accidental duplicate attendance entries
  • Window is configurable in config.py

═══════════════════════════════════════════════════════════════════

TROUBLESHOOTING
─────────────────────────────────────────────────────────────────

Q: Webcam not opening?
A: Check if camera is connected:
   ls -la /dev/video*
   python3 -c "import cv2; print(cv2.VideoCapture(0).isOpened())"

Q: "No face detected" during registration?
A: • Ensure good lighting
   • Keep face 12-18 inches from camera
   • Face should fill at least 25% of frame
   • Check camera is working

Q: Recognition is slow on Raspberry Pi?
A: • Reduce frame resolution in config.py
   • Lower confidence threshold
   • Use fewer stored embeddings
   • See raspberry-pi-setup section in README

Q: ModuleNotFoundError?
A: • Activate virtual environment: source venv/bin/activate
   • Reinstall dependencies: pip install -r requirements.txt

Q: Database permission error?
A: • Check directory permissions: ls -la data/
   • Ensure write access to data/ directory

═══════════════════════════════════════════════════════════════════

SYSTEM REQUIREMENTS
─────────────────────────────────────────────────────────────────

Minimum:
  • OS: Linux (Ubuntu 20.04+)
  • CPU: Dual-core processor
  • RAM: 2GB
  • Webcam: USB or integrated

Recommended:
  • OS: Linux (Ubuntu 22.04)
  • CPU: Intel i5 or equivalent
  • RAM: 4GB+
  • Webcam: 1080p USB

Raspberry Pi 4:
  • RAM: 4GB or more
  • Webcam: Pi Camera v2 or USB
  • SD Card: 32GB+

═══════════════════════════════════════════════════════════════════

DAILY USAGE WORKFLOW
─────────────────────────────────────────────────────────────────

Morning Setup:
  1. Boot system
  2. python3 main.py
  3. Go to "Recognition" tab
  4. Click "Start Recognition"

During Day:
  • Passengers arrive and stand before camera
  • System automatically logs attendance
  • Green/Red box indicates fee status

Verify Attendance:
  • Click "View Attendance" tab
  • Check today's records
  • Export if needed

End of Day:
  • Press 'q' in webcam to exit recognition
  • Application can stay running for next day
  • Database auto-saves

═══════════════════════════════════════════════════════════════════

ADDING NEW PASSENGERS
─────────────────────────────────────────────────────────────────

1. GUI Method (Recommended):
   • Click "Register Passenger" tab
   • Enter: Name, ID, Fee Status
   • Click "Start Registration"
   • Capture 5 face angles
   • Done!

2. CLI Method:
   • Run: python3 main.py --register
   • Follow prompts
   • Capture face angles
   • Done!

═══════════════════════════════════════════════════════════════════

UPDATE FEE STATUS
─────────────────────────────────────────────────────────────────

Mark passenger as paid:

  GUI Method:
    • Go to Admin tab
    • Find passenger in list
    • (Admin features coming soon)

  CLI Method:
    python3 main.py --cli
    Select option 6
    Enter passenger ID
    Enter fee status: "paid" or "unpaid"

═══════════════════════════════════════════════════════════════════

DATABASE INFORMATION
─────────────────────────────────────────────────────────────────

Database Location: data/attendance.db

Tables:
  • passengers: Passenger names, IDs, fee status
  • embeddings: Face encodings for each passenger
  • attendance: Attendance records with timestamps

All data is stored locally - nothing goes to cloud!

Export Data:
  GUI: View Attendance tab → "Export to CSV"
  This creates: attendance_export.csv

═══════════════════════════════════════════════════════════════════

NEXT STEPS
─────────────────────────────────────────────────────────────────

1. Read full README.md for detailed documentation
2. Check config.py for advanced settings
3. Review modules/ for code documentation
4. Set up cron job for daily backups (optional)
5. Deploy to Raspberry Pi (see README)

═══════════════════════════════════════════════════════════════════

Questions? Check:
  • README.md - Full documentation
  • config.py - System configuration
  • logs/system.log - Error logs
  • Code comments - Implementation details

═══════════════════════════════════════════════════════════════════
""")
