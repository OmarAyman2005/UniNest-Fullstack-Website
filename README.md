# UniNest Fullstack Website

## 📌 Overview
UniNest is a fullstack web platform designed to manage university housing, users, and sessions.  
It provides a complete system for handling authentication, user roles, and administrative workflows.

---

## 🚀 Features
- User authentication and role-based access
- University housing management system
- Session and user data handling
- RESTful API integration
- Responsive frontend with modern UI

---

## 🛠️ Tech Stack
- Frontend: React (Next.js)
- Backend: Node.js, Express
- Database: MongoDB
- Other: REST APIs, Authentication

---

## ⚙️ Environment Setup

This project requires environment variables to run correctly.

---

### 🔹 Backend (`server/.env`)

Create a file named `.env` inside the `server/` folder and add:

MONGO_URI=your_mongodb_connection_string  
PORT=5000  
CORS_ORIGIN=http://localhost:3000  

> ⚠️ Important: Without a valid MongoDB connection, the server will run but database features (login, users, sessions) will NOT work.

---

### 🔹 Frontend (`client/.env.local`)

Create a file named `.env.local` inside the `client/` folder:

NEXT_PUBLIC_API_BASE=http://localhost:5000  

---

## 🗄️ MongoDB Setup (Required)

1. Go to MongoDB Atlas  
2. Create a free cluster (M0)  
3. Click **Connect → Drivers**  
4. Copy your connection string  

Example:

mongodb+srv://username:password@cluster.mongodb.net/uninest  

5. Replace `MONGO_URI` in `server/.env`  

6. Allow your IP:
- Go to **Network Access**
- Add: 0.0.0.0/0  

7. Restart backend after updating `.env`

---

## ▶️ How to Run

### 1. Clone the repository

git clone https://github.com/YOUR_USERNAME/UniNest-Fullstack-Website.git  
cd UniNest-Fullstack-Website  

---

### 2. Run Backend

cd server  
npm install  
npm start  

Backend will run on:  
http://localhost:5000  

---

### 3. Run Frontend

Open a new terminal:

cd client  
npm install  
npm run dev  

Frontend will run on:  
http://localhost:3000  

---

## 📁 Project Structure

UniNest-Fullstack-Website/  
│  
├── client/        # Frontend (Next.js)  
├── server/        # Backend (Express API)  
├── README.md  
└── package.json  

---

## 📌 Notes
- This project is intended for educational and demonstration purposes  
- Requires MongoDB connection for full functionality  
- Built without external hosting or deployment  

---

## 👤 Author
Omar Ayman Ahmed  
GitHub: https://github.com/OmarAyman2005
