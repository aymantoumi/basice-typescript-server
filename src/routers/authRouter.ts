import express from 'express';
import { signup, login, getProfile, authenticateToken } from '../controllers/authController.ts';

const authRouter = express.Router();

// Public routes
authRouter.post('/signup', signup);
authRouter.post('/login', login);

// Protected routes
authRouter.get('/profile', authenticateToken, getProfile);

export { authRouter };