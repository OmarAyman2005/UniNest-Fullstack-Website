import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT = 5000,
  MONGO_URI,
  JWT_SECRET,
  CLIENT_URL = 'http://localhost:3000',
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM
} = process.env;
