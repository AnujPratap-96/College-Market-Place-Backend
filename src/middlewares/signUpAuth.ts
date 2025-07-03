import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include 'email'
declare global {
  namespace Express {
    interface Request {
      email?: string;
    }
  }
}

const signUpAuth = async (req:Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.signupToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
         res.status(401).json({ error: "Unauthorized, please verify email first." });
         return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SIGNUP_SECRET!) as { email: string };
        req.email= decoded.email; // Attach email to request object
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
          res.status(401).json({ error: 'Invalid or expired token' });
          return;
    }
}

export default signUpAuth;