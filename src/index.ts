import express from 'express';
import passport from 'passport';
import type { Application } from 'express';
import 'dotenv/config';
import { verificationRouter } from './routers/verificationRouter.ts';
import { userRouter } from "./routers/userRouter.ts";
import { productsRouter } from "./routers/productsRouter.ts";
import { authRouter } from "./routers/authRouter.ts";
import { authPassportRouter } from './routers/authPassport.ts';
import session from 'express-session';
import ordersRouter  from "./routers/ordersRouter.ts";
import './utilities/passportUtility.ts'
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import csrf from "csurf";
import cors from 'cors';

dotenv.config();

const port = process.env.PORT || 3500;

const app: Application = express();

// CORS 
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true, 
}));

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    // true if using HTTPS false for HTTP 
    secure: false, 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
  } 
}));

// CSRF protection 
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: false 
  }
});
// app.use(csrfProtection);

// Initialize Passport 
app.use(passport.initialize());
app.use(passport.session());


// // CSRF token endpoint
// app.get('/api/csrf-token', csrfProtection, (req, res) => {
//   res.json({ csrfToken: req.csrfToken() });
// });

// Routes with CSRF protection
app.use('/auth',  authRouter);
app.use('/users',  userRouter);
app.use('/products', productsRouter);
app.use('/orders',  ordersRouter);
app.use('/passport', authPassportRouter);
app.use('/verify', verificationRouter)

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});