import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Request, Response, Application } from 'express';
import { usersTable } from "../db/schema.ts";


const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';


// Get current user profile (protected route)
export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.userId))
      .limit(1);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = users[0];
    const { password: _, ...userWithoutPassword } = userData;

    res.json({ user: userWithoutPassword });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};
