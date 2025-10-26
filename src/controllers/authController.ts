import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';
import { users } from "../db/schema.ts"; 
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { transporter, createEmailConfig } from '../utilities/tokenUtility.ts';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password }: SignupPayload = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user with simplified schema
    const user = {
      name,
      email,
      password: hashedPassword,
    };

    const result = await db.insert(users)
      .values(user)
      .returning();

    const createdUser = result[0];

    // Generate email verification token
    const verificationToken = jwt.sign(
      {
        userId: createdUser.id,
        email: createdUser.email
      },
      JWT_SECRET, 
      { expiresIn: '10m' }
    );

    // Create email configuration with the verification token
    const mailOptions = createEmailConfig(email, verificationToken);

    // Send verification email 
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.error('Failed to send verification email:', error);
      } else {
        console.log('Verification email sent successfully');
      }
    });

    // Generate AUTH token for immediate login
    const authToken = jwt.sign(
      {
        userId: createdUser.id,
        email: createdUser.email
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = createdUser;

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification.',
      user: userWithoutPassword,
      token: authToken
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginPayload = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user by email
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResults.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = userResults[0];

    // Verify password
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Get current user profile (protected route)
export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const userResults = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userResults[0];
    res.json({ user: userData });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, email } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.userId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result[0];
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update profile' });
  }
};