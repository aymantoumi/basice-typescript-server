import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { users } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

interface User {
  email: string;
  password: string;
}

// Check authentication status
export function checkAuth(req: Request, res: Response) {
  if (req.isAuthenticated()) {
    const user = req.user as any;
    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
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
        
        // Remove sensitive data from response
        const { password: _, ...userWithoutPassword } = user;
        
        return res.status(200).json({
          message: 'Login successful',
          user: userWithoutPassword
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

// Logout 
export function passportLogout(req: Request, res: Response) {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout successful' });
    });
  });
}

// Google OAuth initiation
export const googleAuth = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// Google OAuth callback
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', async (err: any, user: any, info: any) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect(`http://localhost:5173/login?error=auth_failed`);
    }
    
    if (!user) {
      return res.redirect(`http://localhost:5173/login?error=access_denied`);
    }

    // Log the user in
    req.logIn(user, async (err) => {
      if (err) {
        return next(err);
      }
      
      try {
        // Update user's last login
        await db.update(users)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));
          
        console.log('Google OAuth successful, redirecting to frontend...');
        return res.redirect(`http://localhost:5173/dashboard`);
      } catch (dbError) {
        console.error('Database update error:', dbError);
        return res.redirect(`http://localhost:5173/dashboard`);
      }
    });
  })(req, res, next);
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as any;
    const { name, email } = req.body;

    const updateData: any = {
      updatedAt: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    const updatedUsers = await db.update(users)
      .set(updateData)
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    const updatedUser = updatedUsers[0];

    // Update the user in the session
    req.user = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update profile' });
  }
};