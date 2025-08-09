# AI-Copilot-Driver-Alertness-System
AI Co-Pilot is a browser-based driver safety system that detects drowsiness, yawning, and distraction in real time using Mediapipe FaceMesh and JavaScript. It works fully offline, triggers visual/audio alerts, logs events, and features a responsive, attractive UI for rapid, privacy-friendly deployment.

## ✨ Features
- 📹 **Live Camera Feed** – Real-time face tracking directly in the browser.
- 👀 **Blink Detection** – Uses Eye Aspect Ratio (EAR) to detect prolonged eye closure.
- 😮 **Yawn Detection** – Detects mouth opening duration to identify yawning.
- 🧭 **Head Pose Estimation** – Alerts if the driver looks away from the road.
- 🚨 **Smart Alerts** – Red flashing border, sound warning, and log entry when the driver is inattentive.
- 📊 **Real-Time Stats** – Blink count, yawn count, distraction time.
- 🌓 **Day/Night Mode** – Switch UI themes instantly.
- 📱 **Mobile Responsive** – Works on both desktop and mobile browsers.
- Also Ripple effect to the cursor.

⚙️ How It Works

FaceMesh Detection – Mediapipe detects 468 facial landmarks from the webcam feed.
EAR & MAR Calculation
EAR (Eye Aspect Ratio) detects blinks and prolonged closure.
MAR (Mouth Aspect Ratio) detects yawns.
Head Pose Tracking – Uses specific landmarks to estimate yaw and pitch.
Alert System – If drowsiness or distraction is detected:
Red border flashes around the video
Audio alert plays
Event is logged with a timestamp

Guide to use:-

1. Open the website
2. Allow the video permission. ( If the video permission is not asked automatically then click 'OK' when the pop-up arises for error. Then go to site settings      which is beside url, and enable the video and sound permission from there and then reload the website).
3. Then you can use the model by closing eyes for 2-3 seconds, Yawn, Look here and there and blink eyes rapidly to get various alerts respectively.
4. You can change the Day/Night mode by the button available.
5. You can also see number of blinks of your eye below.
6. Also you will get event log with timestamps.

OUR TEAM:- Quantum Flux
Members:- -Aditya Chaudhari
          -Kartik Choube

Our Email ID:- hackathon2505@gmail.com

THANK YOU
