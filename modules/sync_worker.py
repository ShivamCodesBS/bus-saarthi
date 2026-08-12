import time
import threading
import requests
import sqlite3
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - SyncWorker - %(levelname)s - %(message)s')

class SyncWorker(threading.Thread):
    def __init__(self, db_path="data/attendance.db", backend_url="https://invertis-bus.onrender.com", interval=2.0):
        super().__init__()
        self.db_path = db_path
        self.backend_url = backend_url.rstrip('/')
        self.interval = interval
        self.running = True
        self.daemon = True # Dies when main thread dies

    def check_internet(self):
        try:
            requests.get("http://1.1.1.1", timeout=3)
            return True
        except requests.RequestException:
            return False

    def get_endpoints(self):
        return {
            "encoding": f"{self.backend_url}/api/sync/encoding",
            "attendance": f"{self.backend_url}/api/internal/webhook",
            "sensor": f"{self.backend_url}/api/internal/webhook"
        }

    def run(self):
        logging.info("SyncWorker started and running in background.")
        endpoints = self.get_endpoints()
        
        while self.running:
            try:
                # 1. Check if there is internet
                if not self.check_internet():
                    time.sleep(self.interval)
                    continue
                
                # 2. Connect to DB and fetch pending items
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 10")
                items = cursor.fetchall()
                
                if not items:
                    conn.close()
                    time.sleep(self.interval)
                    continue
                    
                # 3. Process each item
                for item in items:
                    item_id = item['id']
                    data_type = item['data_type']
                    payload_str = item['payload']
                    
                    try:
                        payload = json.loads(payload_str)
                    except json.JSONDecodeError:
                        logging.error(f"Invalid JSON payload for item {item_id}. Deleting.")
                        cursor.execute("DELETE FROM sync_queue WHERE id=?", (item_id,))
                        conn.commit()
                        continue
                        
                    endpoint = endpoints.get(data_type)
                    if not endpoint:
                        logging.error(f"Unknown data type {data_type} for item {item_id}. Deleting.")
                        cursor.execute("DELETE FROM sync_queue WHERE id=?", (item_id,))
                        conn.commit()
                        continue
                    
                    # 4. Push to cloud backend
                    try:
                        headers = {'x-hardware-token': 'invertis_hardware_secret_2026'}
                        payload_to_send = {"type": data_type, "data": payload} if data_type in ['sensor', 'attendance'] else payload
                        response = requests.post(endpoint, json=payload_to_send, headers=headers, timeout=5)
                        
                        if response.status_code in [200, 201]:
                            # 5. Success -> delete from local queue
                            cursor.execute("DELETE FROM sync_queue WHERE id=?", (item_id,))
                            conn.commit()
                            logging.info(f"Successfully synced item {item_id} ({data_type}) to cloud.")
                        else:
                            logging.warning(f"Failed to sync item {item_id} ({data_type}). Server responded with {response.status_code}: {response.text}")
                    except requests.RequestException as e:
                        logging.warning(f"Network error syncing item {item_id} ({data_type}): {e}")
                        break # Break loop, wait for next interval to try again
                        
                conn.close()
                time.sleep(min(1.0, self.interval)) # process faster if items remain
                
            except Exception as e:
                logging.error(f"SyncWorker error: {e}")
                time.sleep(self.interval)

    def stop(self):
        self.running = False
        logging.info("SyncWorker stopping...")
