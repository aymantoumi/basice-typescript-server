import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';
import { usersTable } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { transporter, createEmailConfig } from '../utilities/tokenUtility.ts';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

interface SignupPayload {
  name: string;
  email: string;
  password: string;
  age?: number;
  avatar?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, age, avatar }: SignupPayload = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user with new schema fields
    const user: typeof usersTable.$inferInsert = {
      name,
      email,
      password: hashedPassword,
      age: age || null,
      avatar: avatar || null,
      authProvider: 'local',
      emailVerified: false,
    };

    const result = await db.insert(usersTable)
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
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in'
      });
    }

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

    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        age: usersTable.age,
        avatar: usersTable.avatar,
        googleId: usersTable.googleId,
        emailVerified: usersTable.emailVerified,
        authProvider: usersTable.authProvider,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.userId))
      .limit(1);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = users[0];
    res.json({ user: userData });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};