import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const port = process.env.PORT || 3500;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_AUTH,
        pass: process.env.USER_PASS
    }
});
    
export const createEmailConfig = (email: string, token: string) => ({
    from: 'no-replay@gmail.com',
    to: email,
    subject: 'Email Verification',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Hi there!</p>
            <p>You have recently visited our website and entered your email.</p>
            <p>Please click the link below to verify your email address:</p>
            <a href="http://localhost:${port}/verify/${token}" 
               style="background-color: #007bff; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
            </a>
            <p>This link will expire in 10 minutes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
            <br>
            <p>Thanks,<br>Your App Team</p>
        </div>
    `
});