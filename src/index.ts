import express from 'express';
import type { Request, Response, Application } from 'express';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { usersTable } from './db/schema.ts';
import { getAllProducts, createProduct, updateProduct, productDelete } from './controllers/productsController.ts';

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

app.get('/products', async (req, res) => {
  try {
    let products = await getAllProducts();

    res.send(products);

  } catch (error) {
    console.error(error);
  }
})

app.post('/product', async (req, res) => {
  const { name, price, discreption } = req.body;
  console.log(req.body);
  
  try {
    
    let products = await createProduct(name, price, discreption);

    console.log(`product ${name} has been created`);
   
    res.send(products);
  } catch (error) {
   console.error(error);
   res.send(error)
  }
});

app.patch('/product/:product_id', async (req, res) => {
  console.log(req.body);
  let product_id = parseInt(req.params.product_id);
  try {
    const product_result = updateProduct(req.body, product_id)
   res.send(product_result)
  } catch (error) {
    console.error(error);
    console.log('somehting went wrong ');    
  }
})

app.delete('/product/:product_id', async (req, res) => {
  try {
    const p_id = parseInt(req.params.product_id)

    const result = await productDelete(p_id)

    if (!result) {
      res.send({
        'error': `The product ${p_id} doesn't exists`
      })
    }

    res.send({
      "product_id": p_id,
      "status_code": 200 
    })
  } catch (error) {
    console.error(error);
    
  }
})

app.listen(port, () => {
  console.log(`app works on http://localhost:${port}`);
})
