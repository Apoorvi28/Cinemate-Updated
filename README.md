🎬 Cinemate: An Interactive and Emotion‑Adaptive Watch‑Party Platform
Cinemate is a web‑based social streaming application designed to bridge the geographical gap between friends and family. It transforms passive video watching into an interactive, shared experience by allowing multiple users to watch movies or personal videos in a synchronized virtual space.

📌 Project Overview
School: Chitkara University, Rajpura, Punjab
Objective: To create a synchronized multi‑user streaming platform that improves remote social interaction through real‑time communication and personalized themes.
Original Contribution: Cinemate introduces mood‑based theme customization (Romantic, Horror, Happy, Neutral), creating an emotionally engaging experience that sets it apart from traditional streaming platforms.
👥 Team Members & Mentor
Role Name ID / Roll No Contact Details

Student Apoorvi 2210991328 apoorvi13284@gmail.com

Mentor Shyam Goyal CET1003885 shyam.goyal@chitkara.edu.in

🛠️ Technology Stack
Frontend: React, Vite
Backend: Node.js, Express
Database: MongoDB
Real‑Time Engine: Socket.io (for low‑latency synchronization and chat)
File Handling: Multer
Security: JSON Web Tokens (JWT) & Nodemailer (for Two‑Factor Authentication)
✨ Key Features
🎯 Flawless Synchronization: Ensures all participants experience play, pause, and seek actions simultaneously.

💬 Real‑Time Communication: Integrated chat system supporting both text and image sharing.

🎨 Emotion‑Adaptive UI: Mood‑based theme settings to match the viewing atmosphere.

🔐 Secure Access: Multi‑factor authentication including login, registration, and email‑based OTP.

🏠 Room Management: Dynamic room creation with creator‑specific controls.

🚀 Getting Started
✅ Prerequisites
Node.js installed
MongoDB instance (local or MongoDB Atlas)
NPM or Yarn package manager
⚙️ Installation & Setup
1️⃣ Clone the repository
git clone <your-repository-url>
2️⃣ Install Backend Dependencies
cd backend
npm install
3️⃣ Install Frontend Dependencies
cd frontend
npm install
4️⃣ Configuration
Create a .env file inside the backend directory and add:

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
5️⃣ Run the Application
Start Backend

npm start
Start Frontend

npm run dev
📊 System Usage (Input & Output)
Feature Input Expected Output

Authentication User Secure access to personalized credentials + dashboard Email OTP

Media Hosting Video upload Streamable media available in virtual via Multer rooms

Watch Party Play / Pause / Real‑time synchronized playback for Seek actions all users

Personalization Mood selection Dynamic UI theme change across the (e.g., Horror) platform
🌟 Conclusion
Cinemate enhances remote entertainment by combining synchronized streaming, emotional personalization, and real‑time social interaction, making virtual watch‑parties more engaging and immersive than ever before.
