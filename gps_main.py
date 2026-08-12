import time
import math
import sqlite3
import serial
import pynmea2
from smbus2 import SMBus
import os

# ==================== CONFIGURATION ====================
DB_PATH = "data/gps_server.db"
SERIAL_PORT = "/dev/serial0"  # Default hardware serial port on Raspberry Pi
BAUD_RATE = 9600

# I2C Addresses
MPU6050_ADDR = 0x68
HMC5883L_ADDR = 0x1E
QMC5883L_ADDR = 0x0D
QMC5883P_ADDR = 0x2C

# ==================== I2C HELPERS ====================

def read_i2c_word(bus, addr, reg):
    """Read a 16-bit word from an I2C device (Big Endian) and handle 2's complement."""
    high = bus.read_byte_data(addr, reg)
    low = bus.read_byte_data(addr, reg+1)
    value = (high << 8) + low
    if value >= 0x8000:
        return -((65535 - value) + 1)
    return value

def read_i2c_word_little_endian(bus, addr, reg):
    """Read a 16-bit word from an I2C device (Little Endian)."""
    low = bus.read_byte_data(addr, reg)
    high = bus.read_byte_data(addr, reg+1)
    value = (high << 8) + low
    if value >= 0x8000:
        return -((65535 - value) + 1)
    return value

# ==================== SENSOR INITIALIZATION ====================

def init_mpu6050(bus):
    """Wake up the MPU6050 and calibrate resting bias."""
    try:
        # Write 0 to power management register to wake up
        bus.write_byte_data(MPU6050_ADDR, 0x6B, 0x00)
        print("\nMPU6050 Initialized. Calibrating... PLEASE KEEP SENSOR STILL!")
        
        # Calibration loop to determine baseline gravity/tilt
        bias_x, bias_y, bias_z = 0, 0, 0
        samples = 50
        for _ in range(samples):
            bias_x += read_i2c_word(bus, MPU6050_ADDR, 0x3B) / 16384.0
            bias_y += read_i2c_word(bus, MPU6050_ADDR, 0x3D) / 16384.0
            bias_z += read_i2c_word(bus, MPU6050_ADDR, 0x3F) / 16384.0
            time.sleep(0.02)
            
        bias_x /= samples
        bias_y /= samples
        bias_z /= samples
        print(f"Calibration complete. Biases: X={bias_x:.2f}g, Y={bias_y:.2f}g, Z={bias_z:.2f}g\n")
        return True, (bias_x, bias_y, bias_z)
    except Exception as e:
        print(f"Failed to initialize MPU6050: {e}")
        return False, (0, 0, 0)

def init_magnetometer(bus):
    """Try initializing HMC5883L, QMC5883L, and QMC5883P clones."""
    try:
        # Try Original HMC5883L (0x1E)
        bus.write_byte_data(HMC5883L_ADDR, 0x00, 0x70)
        bus.write_byte_data(HMC5883L_ADDR, 0x01, 0xA0)
        bus.write_byte_data(HMC5883L_ADDR, 0x02, 0x00)
        print("HMC5883L Magnetometer Initialized.")
        return "HMC"
    except Exception:
        pass

    try:
        # Try QMC5883L Clone (0x0D)
        bus.write_byte_data(QMC5883L_ADDR, 0x0B, 0x01) # Set/Reset Period
        bus.write_byte_data(QMC5883L_ADDR, 0x09, 0x1D) # Control Reg 1: Continuous, 200Hz, 8G
        print("QMC5883L Magnetometer Initialized.")
        return "QMC_L"
    except Exception:
        pass
        
    try:
        # Try QMC5883P Clone (0x2C)
        bus.write_byte_data(QMC5883P_ADDR, 0x0B, 0x01) # Soft Reset
        time.sleep(0.01)
        bus.write_byte_data(QMC5883P_ADDR, 0x0A, 0x0D) # Control Reg 1: Continuous, 200Hz
        print("QMC5883P Magnetometer Initialized (Found at 0x2C).")
        return "QMC_P"
    except Exception as e:
        print(f"Failed to initialize any Magnetometer: {e}")
        return None

# ==================== DATABASE SETUP ====================

def init_database():
    """Create the SQLite database and tables."""
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            latitude REAL,
            longitude REAL,
            gps_speed_knots REAL,
            accel_x REAL,
            accel_y REAL,
            accel_z REAL,
            heading_deg REAL
        )
    """)
    
    # Safely add the new mpu_speed_kmh column if it doesn't already exist
    try:
        cursor.execute("ALTER TABLE sensor_data ADD COLUMN mpu_speed_kmh REAL")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    conn.commit()
    print(f"Database initialized at {DB_PATH}")
    return conn

# ==================== MAIN LOOP ====================

def main():
    print("Starting Sensor Tracking System...")
    
    # Start Cloud Sync Worker in background
    try:
        from modules.sync_worker import SyncWorker
        sync_worker = SyncWorker(interval=2.0)
        sync_worker.start()
        print("SyncWorker started for sensor data.")
    except Exception as e:
        print(f"Failed to start SyncWorker: {e}")
    
    # 1. Initialize DB
    conn = init_database()
    cursor = conn.cursor()

    # 2. Initialize I2C Bus (Usually bus 1 on Raspberry Pi)
    try:
        bus = SMBus(1)
        mpu_ready, mpu_bias = init_mpu6050(bus)
        mag_type = init_magnetometer(bus)
    except Exception as e:
        print(f"Critical I2C Bus Error: {e}. Check your wiring!")
        bus = None
        mpu_ready = False
        mpu_bias = (0, 0, 0)
        mag_type = None

    # 3. Initialize UART (GPS)
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"Listening for GPS on {SERIAL_PORT}...")
    except Exception as e:
        print(f"Failed to open Serial Port {SERIAL_PORT}: {e}")
        ser = None

    print("\n--- ENTERING MAIN LOOP ---")
    print("Press Ctrl+C to exit.\n")
    
    # Physics and Timing Variables
    last_time = time.time()
    last_db_time = time.time()
    last_print_time = time.time()
    vel_x, vel_y, vel_z = 0.0, 0.0, 0.0
    
    try:
        while True:
            # Timing
            current_time = time.time()
            dt = current_time - last_time
            last_time = current_time
            
            # Variables for this polling cycle
            lat = None
            lon = None
            gps_speed = None
            accel_x, accel_y, accel_z = None, None, None
            heading = None
            mpu_speed_kmh = 0.0

            # --- READ GPS ---
            if ser and ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('ascii', errors='replace')
                    if line.startswith('$GPRMC') or line.startswith('$GPGGA'):
                        msg = pynmea2.parse(line)
                        if hasattr(msg, 'latitude') and msg.latitude != 0.0:
                            lat = msg.latitude
                            lon = msg.longitude
                        if hasattr(msg, 'spd_over_grnd'):
                            gps_speed = msg.spd_over_grnd
                except Exception as e:
                    # Ignore parsing errors from corrupted serial lines
                    pass

            # --- READ MPU6050 ---
            if mpu_ready:
                try:
                    # Raw accelerometer values in Gs
                    raw_x = read_i2c_word(bus, MPU6050_ADDR, 0x3B) / 16384.0
                    raw_y = read_i2c_word(bus, MPU6050_ADDR, 0x3D) / 16384.0
                    raw_z = read_i2c_word(bus, MPU6050_ADDR, 0x3F) / 16384.0
                    
                    accel_x, accel_y, accel_z = raw_x, raw_y, raw_z
                    
                    # Subtract static gravity/tilt bias
                    net_x = raw_x - mpu_bias[0]
                    net_y = raw_y - mpu_bias[1]
                    net_z = raw_z - mpu_bias[2]
                    
                    # Convert to meters per second squared (m/s^2)
                    net_x_mps2 = net_x * 9.81
                    net_y_mps2 = net_y * 9.81
                    net_z_mps2 = net_z * 9.81
                    
                    # Deadband filter to ignore engine vibration and noise (< 0.05g)
                    DEADBAND = 0.05 * 9.81
                    if abs(net_x_mps2) < DEADBAND: net_x_mps2 = 0
                    if abs(net_y_mps2) < DEADBAND: net_y_mps2 = 0
                    if abs(net_z_mps2) < DEADBAND: net_z_mps2 = 0
                    
                    # Integrate acceleration over time (dt) to get velocity
                    vel_x += net_x_mps2 * dt
                    vel_y += net_y_mps2 * dt
                    vel_z += net_z_mps2 * dt
                    
                    # Friction decay (drags speed to zero if you stop accelerating, combats infinite drift)
                    vel_x *= 0.95
                    vel_y *= 0.95
                    vel_z *= 0.95
                    
                    # Calculate total speed vector magnitude (m/s)
                    speed_mps = math.sqrt(vel_x**2 + vel_y**2 + vel_z**2)
                    
                    # Convert m/s to km/h
                    mpu_speed_kmh = speed_mps * 3.6
                except Exception as e:
                    print(f"MPU6050 Read Error: {e}")

            # --- READ MAGNETOMETER ---
            if mag_type == "HMC":
                try:
                    # HMC is Big-Endian and registers are X=3, Z=5, Y=7
                    x = read_i2c_word(bus, HMC5883L_ADDR, 0x03)
                    z = read_i2c_word(bus, HMC5883L_ADDR, 0x05)
                    y = read_i2c_word(bus, HMC5883L_ADDR, 0x07)
                    heading = math.degrees(math.atan2(y, x))
                    if heading < 0: heading += 360
                except Exception as e:
                    print(f"HMC5883L Read Error: {e}")
            elif mag_type == "QMC_L":
                try:
                    # QMC5883L is Little-Endian and registers are X=0, Y=2, Z=4
                    x = read_i2c_word_little_endian(bus, QMC5883L_ADDR, 0x00)
                    y = read_i2c_word_little_endian(bus, QMC5883L_ADDR, 0x02)
                    z = read_i2c_word_little_endian(bus, QMC5883L_ADDR, 0x04)
                    heading = math.degrees(math.atan2(y, x))
                    if heading < 0: heading += 360
                except Exception as e:
                    print(f"QMC5883L Read Error: {e}")
            elif mag_type == "QMC_P":
                try:
                    # QMC5883P is Little-Endian and registers are X=1, Y=3, Z=5
                    x = read_i2c_word_little_endian(bus, QMC5883P_ADDR, 0x01)
                    y = read_i2c_word_little_endian(bus, QMC5883P_ADDR, 0x03)
                    z = read_i2c_word_little_endian(bus, QMC5883P_ADDR, 0x05)
                    heading = math.degrees(math.atan2(y, x))
                    if heading < 0: heading += 360
                except Exception as e:
                    print(f"QMC5883P Read Error: {e}")

            # --- SAVE TO DATABASE (EVERY 2 SECONDS) ---
            if current_time - last_db_time >= 2.0:
                cursor.execute("""
                    INSERT INTO sensor_data 
                    (latitude, longitude, gps_speed_knots, accel_x, accel_y, accel_z, heading_deg, mpu_speed_kmh)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (lat, lon, gps_speed, accel_x, accel_y, accel_z, heading, mpu_speed_kmh))
                conn.commit()
                
                # Also save to unified sync queue for cloud upload
                try:
                    import json
                    from datetime import datetime, timezone
                    import config
                    sync_conn = sqlite3.connect("data/attendance.db")
                    sync_cursor = sync_conn.cursor()
                    payload = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "latitude": lat,
                        "longitude": lon,
                        "gps_speed_knots": gps_speed,
                        "accel_x": accel_x,
                        "accel_y": accel_y,
                        "accel_z": accel_z,
                        "heading_deg": heading,
                        "mpu_speed_kmh": mpu_speed_kmh,
                        "route_id": getattr(config, 'ROUTE_ID', '4')
                    }
                    sync_cursor.execute(
                        "INSERT INTO sync_queue (data_type, payload) VALUES (?, ?)",
                        ('sensor', json.dumps(payload))
                    )
                    sync_conn.commit()
                    sync_conn.close()
                except Exception as e:
                    print(f"Failed to add sensor data to sync queue: {e}")
                    
                last_db_time = current_time

            # --- TERMINAL OUTPUT (EVERY 1 SECOND) ---
            if current_time - last_print_time >= 1.0:
                # Calculate GPS speed in km/h (1 knot = 1.852 km/h)
                gps_speed_kmh = (gps_speed * 1.852) if gps_speed is not None else None
                gps_speed_str = f"{gps_speed_kmh:.1f} km/h" if gps_speed_kmh is not None else "N/A"

                # Print output for debugging
                print(f"Lat: {lat or 'N/A'}, Lon: {lon or 'N/A'} | "
                      f"GPS Speed: {gps_speed_str} | "
                      f"MPU Speed: {mpu_speed_kmh:.1f} km/h | "
                      f"Heading: {heading or 0:.0f}°")
                last_print_time = current_time

            # Sleep briefly for a fast polling loop (10Hz). 
            # A fast loop is required so the MPU integration engine doesn't miss sudden accelerations!
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nExiting nicely...")
    finally:
        if ser:
            ser.close()
        if bus:
            bus.close()
        conn.close()

if __name__ == "__main__":
    main()
