import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { compare } from 'bcryptjs';
import { usersTable } from '../db/schema.ts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import dotenv from "dotenv";

dotenv.config();
const db = drizzle(process.env.DATABASE_URL!);

// Configure LocalStrategy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password"
    },
    async (email: string, password: string, done) => {
      try {
        const users = await db.select().from(usersTable).where(
          eq(usersTable.email, email)
        ).limit(1);

        if (users.length === 0) {
          return done(null, false, { message: "Invalid email or password." });
        }

        const user = users[0];
        
        const isPasswordValid = await compare(password, user.password);
        
        if (!isPasswordValid) {
          return done(null, false, { message: "Invalid email or password." });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Configure GoogleStrategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/passport/google/callback",
      scope: ["profile", "email"]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        const existingUsers = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.googleId, profile.id))
          .limit(1);

        if (existingUsers.length > 0) {
          return done(null, existingUsers[0]);
        }

        // Check if user exists with the same email but different auth method
        const usersByEmail = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, profile.emails![0].value))
          .limit(1);

        if (usersByEmail.length > 0) {
          // Update existing user with Google ID
          const updatedUsers = await db
            .update(usersTable)
            .set({ 
              googleId: profile.id,
              // Optionally update other fields from Google profile
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value 
            })
            .where(eq(usersTable.id, usersByEmail[0].id))
            .returning();

          return done(null, updatedUsers[0]);
        }

        // Create new user with Google authentication
        const newUser = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails![0].value,
          password: null,
          avatar: profile.photos?.[0]?.value,
          age: null,
          // Google emails are verified
          emailVerified: true, 
          authProvider: 'google'
        };

        const result = await db
          .insert(usersTable)
          .values(newUser)
          .returning();

        return done(null, result[0]);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, false);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const users = await db.select().from(usersTable).where(
      eq(usersTable.id, id)
    ).limit(1);
    
    if (users.length === 0) {
      return done(null, false);
    }
    
    done(null, users[0]);
  } catch (error) {
    done(error);
  }
});