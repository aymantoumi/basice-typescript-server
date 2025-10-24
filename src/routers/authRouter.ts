import express from 'express';
import { signup, login, getProfile } from '../controllers/authController.ts';
import { authenticateToken } from "../middleware/authMiddleware.ts";

const authRouter = express.Router();

// Public routes
authRouter.post('/signup', signup);
authRouter.post('/login', login);

// Protected routes
authRouter.get('/profile', authenticateToken, getProfile);

export { authRouter };