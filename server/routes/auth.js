const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Google Sign-In
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ message: 'Google credential missing' });
        }

        // Verify the ID token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Check if user exists by googleId
        let user = await User.findOne({ where: { googleId } });

        if (!user) {
            // Check if user exists by email (legacy linkage)
            user = await User.findOne({ where: { email } });

            if (user) {
                // Link Google account to existing user
                user.googleId = googleId;
                user.avatar = picture;
                await user.save();
            } else {
                // Create a new user
                user = await User.create({
                    username: name || email.split('@')[0], // username fallback
                    email,
                    googleId,
                    avatar: picture
                });
            }
        } else {
            // Update avatar if changed
            if (user.avatar !== picture) {
                user.avatar = picture;
                await user.save();
            }
        }

        // Issue standard JWT token for our app
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, username: user.username, avatar: user.avatar });
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(500).json({ message: 'Authentication failed' });
    }
});

module.exports = router;
