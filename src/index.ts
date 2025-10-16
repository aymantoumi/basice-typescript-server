import express from 'express';
import type { Request, Response, Application } from 'express';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { usersTable } from './db/schema.ts';

import dotenv from "dotenv";
import { numeric } from 'drizzle-orm/pg-core';


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
app.put('/:id',async(req: Request, res:Response)=>{
  let id = req.params.id;
  let body = req.body;
  await db.update(usersTable).set({name:body.name,age:body.age,email:body.email}).where(eq(usersTable.id,Number(id)));
    res.send("user updated");
})
app.patch('/:id',async(req: Request, res:Response)=>{
  let id = req.params.id;
  let {name,age,email} = req.body;
  await db.update(usersTable).set({name:name,age:age,email:email}).where(eq(usersTable.id,Number(id)));
    res.send("user updated");
})
app.get('/:id',async(req:Request,res:Response)=>{
  let id = req.params.id;
  const user = await db.select().from(usersTable).where(eq(usersTable.id,Number(id)));
  res.send(user);
});
app.delete('/:id',async(req:Request,res:Response)=>{
  let id = req.params.id;  
  await db.delete(usersTable).where(eq(usersTable.id,Number(id)));
  res.send("user deleted");
})
app.listen(port, () => {
  console.log(`app works on http://localhost:${port}`);
})
