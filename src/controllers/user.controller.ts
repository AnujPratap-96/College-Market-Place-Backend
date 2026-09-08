// src/controllers/auth/signup.controller.ts
import { Request, Response } from 'express';
import prisma from '../prisma';
import { generateOtp } from '../utils/generateOtp';
import { sendOtpEmail } from '../utils/sendOtpEmail';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const emailsignup = async (req: Request, res: Response): Promise<void> => {
  console.log("Signup request received:", req.body);
  try {
    const { email } = req.body;
    console.log("Email to register:", email);

    if (!email) {
      console.log("No email provided");
      res.status(400).json({ message: "Email is required." });
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format");
      res.status(400).json({ message: "Invalid email address." });
      return;
    }

    const lastOtp = await prisma.oTP.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lastOtp) {
      res.status(429).json({
        message: "OTP recently sent. Please wait a minute before trying again.",
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ message: "User already exists." });
      return;
    }

    const { otp, expiresAt } = generateOtp();
    console.log("Generated OTP:", otp);

    await prisma.oTP.create({
      data: { email, code: otp, expiresAt },
    });

    console.log("Sending OTP email...");
    await sendOtpEmail(email, otp);
    console.log("OTP email sent!");

    const token = jwt.sign({ email }, process.env.JWT_SIGNUP_SECRET!, { expiresIn: '15m' });
    console.log("Generated signup token");

    res.cookie('signupToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      message: `OTP sent to ${email}`,
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Something went wrong.", error: String(error) });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    const email = req.email;

    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP are required." });
      return;
    }

    const validOtp = await prisma.oTP.findFirst({
      where: {
        email,
        code: otp,
        expiresAt: { gte: new Date() },
      },
    });

    if (!validOtp) {
      res.status(400).json({ error: "Invalid or expired OTP." });
      return;
    }

    await prisma.oTP.delete({
      where: { id: validOtp.id },
    });

    res.status(200).json({ message: "OTP verified, please complete signup." });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

export const completeSignup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, name, college, branch, year, phone } = req.body;
    const email = req.email;

    if (!email || !password || !name || !college || !branch || !year || !phone) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: "User already exists." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        college,
        branch,
        year,
        phone,
        isVerified: true, // Optional: mark verified
      },
    });

    res.clearCookie('signupToken'); // Optional: clear JWT cookie after signup

    res.status(200).json({ message: "User created successfully.", userId: newUser.id });
  } catch (error) {
    console.error("Complete signup error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_LOGIN_SECRET!, { expiresIn: '8h' });

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful.", userId: user.id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Something went wrong." });

  }

}


export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized access." });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        college: true,
        branch: true,
        year: true,
        phone: true,
        profileImage: true,
        isVerified: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.status(200).json({ ...user, phoneNo: user.phone, image: user.profileImage });
  }
  catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(200).json({ message: "Logout successful." });
  }
  catch (error) {
    res.status(500).json({
      error: "Something went wrong!!"
    })
  }
}

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { name, phoneNo, college, branch, year, image } = req.body;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phoneNo && { phone: phoneNo }),
        ...(college && { college }),
        ...(branch && { branch }),
        ...(year && { year }),
        ...(image && { profileImage: image }),
      },
    });
    res.status(200).json({ message: 'Profile updated successfully', user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};


export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success anyway to prevent email enumeration
      res.status(200).json({ message: 'If that email exists, an OTP has been sent.' });
      return;
    }

    const lastOtp = await prisma.oTP.findFirst({
      where: {
        email,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      res.status(429).json({ error: 'OTP recently sent. Please wait a minute before trying again.' });
      return;
    }

    const { otp, expiresAt } = generateOtp();

    await prisma.oTP.create({
      data: { email, code: otp, expiresAt },
    });

    await sendOtpEmail(email, otp);

    const token = jwt.sign({ email }, process.env.JWT_SIGNUP_SECRET!, { expiresIn: '15m' });

    res.cookie('resetToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({ message: 'If that email exists, an OTP has been sent.', token });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};

export const verifyResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    const email = req.email;

    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP are required.' });
      return;
    }

    const validOtp = await prisma.oTP.findFirst({
      where: {
        email,
        code: otp,
        expiresAt: { gte: new Date() },
      },
    });

    if (!validOtp) {
      res.status(400).json({ error: 'Invalid or expired OTP.' });
      return;
    }

    await prisma.oTP.delete({ where: { id: validOtp.id } });

    // Issue a short-lived token to authorize the password reset step
    const resetToken = jwt.sign({ email, verified: true }, process.env.JWT_SIGNUP_SECRET!, { expiresIn: '10m' });

    res.cookie('resetToken', resetToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    res.status(200).json({ message: 'OTP verified. You may now reset your password.', token: resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const email = req.email;

    if (!email) {
      res.status(401).json({ error: 'Unauthorized. Please restart the reset flow.' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    res.clearCookie('resetToken');
    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};
