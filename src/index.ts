import express from 'express';
import type { Request, Response, Application } from 'express';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { usersTable } from './db/schema.ts';

import dotenv from "dotenv";


const db = drizzle(process.env.DATABASE_URL!);
const port = process.env.PORT

const app: Application = express();
app.use(express.json());

app.get('/', async (req: Request, res: Response) => {
  try {
    const users = await db.select().from(usersTable);

    res.send(users);
  } catch (error) {
    console.log("something went wrong");
    console.error(error);
  }

})

app.post('/', async (req: Request, res: Response) => {
  const { name, age, email } = req.body;

  try {
    const user: typeof usersTable.$inferInsert = {
      name: name,
      age: age,
      email: email
    } 

    await db.insert(usersTable).values(user);
    res.send(user)
    console.log("user has been created");
    
  } catch (error) {
    console.error(error);
    console.log('something went wrong ');
       
  }
})

app.listen(port, () => {
  console.log(`app works on http://localhost:${port}`);
})
