"""
TRINETRA companion detector (reference implementation).

Reads the rover's MJPEG stream, runs YOLOv8, and writes the latest result to
Firebase RTDB at /rover/detections at ~TARGET_FPS. The dashboard only displays it.

Env vars:
  STREAM_URL               e.g. http://192.168.1.50:81/stream
  FIREBASE_CREDENTIALS     path to a service-account JSON (never commit it)
  FIREBASE_DATABASE_URL    e.g. https://<project>-default-rtdb.firebaseio.com
  MODEL                    default yolov8n.pt (auto-downloaded on first run)
  TARGET_FPS               default 5
  MIN_CONFIDENCE           default 0.4
"""
import os
import threading
import time

import cv2
import firebase_admin
from firebase_admin import credentials, db
from ultralytics import YOLO

STREAM_URL = os.environ["STREAM_URL"]
TARGET_FPS = float(os.getenv("TARGET_FPS", "5"))
MIN_CONF = float(os.getenv("MIN_CONFIDENCE", "0.4"))

firebase_admin.initialize_app(
    credentials.Certificate(os.environ["FIREBASE_CREDENTIALS"]),
    {"databaseURL": os.environ["FIREBASE_DATABASE_URL"]},
)
detections_ref = db.reference("rover/detections")
model = YOLO(os.getenv("MODEL", "yolov8n.pt"))


class LatestFrame:
    """Reads frames in a background thread and keeps only the newest one,
    so slow inference never builds up a backlog of stale frames."""

    def __init__(self, url):
        self.url, self.frame, self.lock = url, None, threading.Lock()
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            cap = cv2.VideoCapture(self.url)
            if not cap.isOpened():
                print("[detect] stream unavailable, retrying in 2s")
                time.sleep(2)
                continue
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("[detect] stream dropped, reconnecting")
                    break
                with self.lock:
                    self.frame = frame
            cap.release()
            time.sleep(1)

    def get(self):
        with self.lock:
            frame, self.frame = self.frame, None
            return frame


def main():
    source = LatestFrame(STREAM_URL)
    interval = 1.0 / TARGET_FPS
    print(f"[detect] running at <= {TARGET_FPS} FPS on {STREAM_URL}")

    while True:
        started = time.monotonic()
        frame = source.get()
        if frame is not None:
            h, w = frame.shape[:2]
            result = model(frame, conf=MIN_CONF, verbose=False)[0]
            objects = []
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                objects.append({
                    "label": result.names[int(box.cls)],
                    "confidence": round(float(box.conf), 3),
                    "bbox": [round(x1), round(y1), round(x2 - x1), round(y2 - y1)],  # x, y, w, h (top-left origin)
                })
            # Always write, even with no objects, so the dashboard knows the feed is fresh.
            detections_ref.set({
                "timestamp": int(time.time() * 1000),
                "frameWidth": w,
                "frameHeight": h,
                "objects": objects,
            })
        time.sleep(max(0.0, interval - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
