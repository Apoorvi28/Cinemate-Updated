const express = require('express');
const bcrypt = require('bcryptjs');
const { SignJWT } = require('jose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

// Helper: sign a JWT using jose
async function signToken(payload) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

// POST /signup - Register a new user
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Check if the user already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create a new user
      user = new User({ email, password: hashedPassword });
      await user.save();

      // Generate a JWT token using jose
      const token = await signToken({ user: { id: user.id } });
      res.json({ token });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// Setup Nodemailer transporter
const nodemailer = require('nodemailer');
// Helper to get transporter
const getTransporter = async () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    let testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user, 
        pass: testAccount.pass, 
      },
    });
  }
};

// POST /login - Authenticate user and send OTP
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: errors.array()[0].msg || 'Invalid input' });
    }

    const { email, password } = req.body;

    try {
      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      // Compare the password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
      }

      // Generate 6 digit OTP for 2FA
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.loginOtp = otp;
      user.loginOtpExpiry = Date.now() + 5 * 60 * 1000; // 5 mins
      await user.save();

      // Send 2FA email
      const transporter = await getTransporter();
      let info = await transporter.sendMail({
        from: '"Watch Party" <no-reply@watchparty.com>',
        to: email,
        subject: "Login Verification OTP",
        html: `<b>Your login 2FA verification OTP is: ${otp}</b><br>It is valid for 5 minutes.`,
      });
      
      if (!process.env.EMAIL_USER) {
        console.log("2FA Preview URL: %s", nodemailer.getTestMessageUrl(info));
      }

      res.json({ msg: 'OTP sent to email', require2FA: true });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// POST /verify-login - Verify the 2FA OTP and issue token
router.post('/verify-login', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: errors.array()[0].msg });
  }
  const { email, otp } = req.body;
  
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid request' });

    if (user.loginOtp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }
    if (Date.now() > user.loginOtpExpiry) {
      return res.status(400).json({ msg: 'OTP has expired' });
    }

    // Clear the OTP
    user.loginOtp = undefined;
    user.loginOtpExpiry = undefined;
    await user.save();

    // Generate a JWT token using jose
    const token = await signToken({ user: { id: user.id } });
    res.json({ token, msg: 'Login successful' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /forgot-password - Send OTP for password reset
router.post('/forgot-password', [body('email').isEmail()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: errors.array()[0].msg || 'Invalid email format' });
  
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User with this email does not exist' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save OTP to user, expires in 10 minutes
    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send email
    const transporter = await getTransporter();
    let info = await transporter.sendMail({
      from: '"Watch Party" <no-reply@watchparty.com>',
      to: email,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is ${otp}. It is valid for 10 minutes.`,
      html: `<b>Your password reset OTP is: ${otp}</b><br>It is valid for 10 minutes.`,
    });

    console.log("Message sent: %s", info.messageId);
    if (!process.env.EMAIL_USER) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    res.json({ msg: 'OTP sent to your email.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /reset-password - Verify OTP and Reset Password
router.post('/reset-password', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: errors.array()[0].msg });

  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid request' });

    // Check OTP and Expiry
    if (user.resetOtp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }
    if (Date.now() > user.resetOtpExpiry) {
      return res.status(400).json({ msg: 'OTP has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ msg: 'Password has been successfully reset. You can now login.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
