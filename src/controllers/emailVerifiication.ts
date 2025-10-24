import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { usersTable } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    console.log('Verification token received:', token);

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    console.log('Decoded token:', decoded);
    
    // Check if user exists
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (existingUsers.length === 0) {
      console.log('User not found with ID:', decoded.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = existingUsers[0];
    console.log('User found:', user.email);

    // FIX: Use the correct column name - emailVerified (camelCase)
    await db.update(usersTable)
      .set({ emailVerified: true }) // ← Changed from email_verified to emailVerified
      .where(eq(usersTable.id, decoded.userId));

    console.log('Email verified successfully for:', user.email);

    // Redirect to login page with success message
    res.redirect('http://localhost:5173/login?verified=success');
    
  } catch (error) {
    console.error('Email verification error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Token expired');
      return res.redirect('http://localhost:5173/login?verified=expired');
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid token:', error.message);
      return res.redirect('http://localhost:5173/login?verified=invalid');
    }
    
    console.log('Other error:', error);
    res.redirect('http://localhost:5173/login?verified=failed');
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = existingUsers[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Send verification email
    const mailOptions = createEmailConfig(email, verificationToken);
    
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Verification email sent successfully' });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
};