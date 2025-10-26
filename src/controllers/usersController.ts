import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm'
import { users } from "../db/schema.ts";

type UserPayload = Partial<{
  name?: string;
  age?: number;
  email?: string;
  password?: string;
}>;

const db = drizzle(process.env.DATABASE_URL!);

export async function createUser(req: any, res: any) {
  const { name, email, password, age } = req.body;

  try {
    const user: typeof users.$inferInsert = {
      name: name,
      age: age,
      email: email,
      password: password, 
    }

    const result = await db.insert(users).values(user).returning();
    const createdUser = result[0];

    res.status(201).json({
      message: 'User created successfully',
      user: createdUser
    });
    console.log('User created with success');

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function getUserById(req: any, res: any) {
  const user_id = parseInt(req.params.user_id);

  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const users = await db.select().from(users).where(eq(users.id, user_id));
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({ user });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateUser(req: any, res: any) {
  const user_id = parseInt(req.params.user_id);
  const { name, email, password, age } = req.body;

  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const existingUsers = await db.select().from(users).where(eq(users.id, user_id));
    
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: UserPayload = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;
    if (age !== undefined) updateData.age = age;

    const updatedUsers = await db.update(users)
      .set(updateData)
      .where(eq(users.id, user_id))
      .returning();

    const updatedUser = updatedUsers[0];

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req: any, res: any) {
  const user_id = parseInt(req.params.user_id);

  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const existingUsers = await db.select().from(users).where(eq(users.id, user_id));
    
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.delete(users).where(eq(users.id, user_id));

    res.json({ 
      message: 'User deleted successfully',
      deletedUserId: user_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

export async function getAllUsers(req: any, res: any) {
  try {
    const users = await db.select().from(users);
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}