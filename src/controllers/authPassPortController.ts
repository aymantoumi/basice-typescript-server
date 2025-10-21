import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';

interface User {
  email: string;
  password: string;
}

// Check authentication status
export function checkAuth(req: Request, res: Response) {
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      }
    });
  } else {
    return res.json({
      authenticated: false
    });
  }
}

// Local strategy login
export async function passportLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password }: User = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Use passport.authenticate with LocalStrategy
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({
          error: info?.message || 'Authentication failed'
        });
      }

      // Log the user in
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        
        return res.status(200).json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      });
    })(req, res, next);
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}

// Logout function
export function passportLogout(req: Request, res: Response) {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.status(200).json({ message: 'Logout successful' });
  });
}

// Google OAuth initiation
export const googleAuth = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// Google OAuth callback
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', (err: any, user: any, info: any) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect(`http://localhost:5173/login?error=auth_failed`);
    }
    
    if (!user) {
      return res.redirect(`http://localhost:5173/login?error=access_denied`);
    }

    // Log the user in
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      
      // Successful authentication - redirect to frontend dashboard
      console.log('Google OAuth successful, redirecting to frontend...');
      return res.redirect(`http://localhost:5173/dashboard`);
    });
  })(req, res, next);
};

// Alternative: Google callback that returns JSON (for SPA)
export const googleCallbackJson = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', (err: any, user: any, info: any) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.status(500).json({ error: 'Google authentication failed' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Access denied' });
    }

    // Log the user in
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      
      return res.json({
        message: 'Google authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    });
  })(req, res, next);
};