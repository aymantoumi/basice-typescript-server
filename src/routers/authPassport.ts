import express from 'express';
import { 
  passportLogin, 
  passportLogout,
  checkAuth,
  googleAuth,
  googleCallback 
} from '../controllers/authPassPortController.ts';

const authPassportRouter = express.Router();

// Local authentication routes
authPassportRouter.post('/login', passportLogin);
authPassportRouter.post('/logout', passportLogout);
authPassportRouter.get('/check-auth', checkAuth);

// Google OAuth routes
authPassportRouter.get('/google', googleAuth);
authPassportRouter.get('/google/callback', googleCallback);

export { authPassportRouter };