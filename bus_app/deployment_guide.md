# 🚀 Invertis Bus Saarthi - Full Deployment Guide

This guide covers the step-by-step process for deploying all components of the **Invertis Bus Saarthi** system to production environments.

> [!IMPORTANT]  
> Ensure you have your production environment variables (MongoDB URI, Cloudinary API Keys, JWT Secrets) ready before proceeding.

---

## 1. Database Deployment (MongoDB Atlas)

The system relies on MongoDB. The easiest and most scalable way to deploy is using MongoDB Atlas.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account/cluster.
2. Under **Database Access**, create a new database user (e.g., `db_user`) with a secure password.
3. Under **Network Access**, add `0.0.0.0/0` to allow connections from anywhere (or restrict it to your backend server's IP if known).
4. Click **Connect**, choose **Drivers**, and copy your `MONGODB_URI`.
   - *Example:* `mongodb+srv://db_user:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`

---

## 2. Backend API Deployment (Render / Heroku)

Your Node.js backend handles Websockets, Face Registration, and Database communication. We recommend deploying to [Render](https://render.com) for easy Node.js hosting.

1. Push your latest code to your GitHub repository (`https://github.com/alokydv9045/bus-sarthi.git`).
2. Log into Render and click **New+** -> **Web Service**.
3. Connect your GitHub repository and select the `bus-sarthi` repo.
4. **Configuration:**
   - **Root Directory:** `INVERTIS_BUS_SAARTHI/backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. **Environment Variables:** Add all variables from your local `.env` file to the Render dashboard:
   - `MONGODB_URI` (Your Atlas URI)
   - `DATABASE_NAME` = `bus_management_db`
   - `JWT_SECRET` = (Your secure secret)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
6. Click **Deploy**. Once deployed, Render will give you a live URL (e.g., `https://bus-sarthi-api.onrender.com`).

---

## 3. Web Admin Dashboard Deployment (Vercel)

The React web dashboard allows managers to view real-time maps and analytics.

1. Go to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2. Select your `bus-sarthi` GitHub repository.
3. **Configuration:**
   - **Framework Preset:** Vite or React
   - **Root Directory:** `INVERTIS_BUS_SAARTHI` (or wherever your `package.json` for the frontend is located).
   - **Build Command:** `npm run build`
4. **Environment Variables:**
   - You must point the web app to your new live backend URL. Add `VITE_BACKEND_URL` (or your specific env variable name) set to `https://bus-sarthi-api.onrender.com`.
5. Click **Deploy**.

---

## 4. Flutter Driver & Sensor App Deployment (Android)

The Flutter app runs on the tablets mounted in the buses. It must be pointed to the production backend before you build the APK.

### A. Update the Backend URL
1. Open `bus_sensor_app/lib/core/constants.dart`.
2. Change `AppConstants.backendUrl` from `http://localhost:5000` to your live backend URL:
```dart
class AppConstants {
  static const String backendUrl = 'https://bus-sarthi-api.onrender.com';
  // ...
}
```

### B. Build the Release APK
To build a highly optimized, fast release APK for the Android tablets:

1. Open a terminal in the `bus_sensor_app` directory.
2. Run the flutter build command:
```bash
flutter clean
flutter pub get
flutter build apk --release
```
3. Once complete, the APK will be generated at:
   `build/app/outputs/flutter-apk/app-release.apk`

### C. Installation
1. Transfer `app-release.apk` to the Bus Android Tablets (via USB, Google Drive, or Email).
2. Open the file on the tablet and tap **Install**.
   - *(You may need to enable "Install from Unknown Sources" in Android Settings).*

---

## 5. Final System Verification

> [!TIP]
> Perform a dry-run test before live deployment on a bus.

1. **Admin Verification:** Open the Flutter app on an admin device, log in as Admin, and register a test face using the live server.
2. **Offline Sync Verification:** Turn off Wi-Fi on the driver tablet, scan a face to verify offline attendance queueing, then turn Wi-Fi back on. Ensure the background `WorkManager` syncs the data to the backend.
3. **Real-time Map Verification:** Check the deployed Vercel Web Dashboard to ensure the bus GPS coordinates are updating on the map in real-time.
