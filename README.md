# UniNest Fullstack Website

## Environment

# server/.env
MONGO_URI="your-mongodb-connection-string"
PORT=5000
CORS_ORIGIN=http://localhost:3000

# client/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:5000

## 🚀 How to Run

### Backend
cd server
npm install
npm start

### Frontend
cd client
npm install
npm run dev

### Environment Variables

Create a `.env` file inside `server/`:

MONGO_URI=your_mongodb_connection_string
PORT=5000
