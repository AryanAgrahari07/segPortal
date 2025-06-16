const { executeQuery } = require('../../database/database');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Create email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    // secure: false,
    // requireTLS: true,
    auth: {
        user: process.env.OTP_EMAIL.trim(),
        pass: process.env.OTP_PASSWORD.replace(/['"]/g, '').trim()
    },
    // tls: {
    //     rejectUnauthorized: false,
    //     minVersion: 'TLSv1.2',
      
    // },
    
});


// Verify SMTP connection on startup
transporter.verify()
    .then(() => console.log('SMTP Server connection established'))
    .catch(error => {
        console.error('SMTP Connection Error:', {
            code: error.code,
            message: error.message
        });
        process.exit(1); // Exit if SMTP connection fails on startup
});


// Function to send OTP email
async function sendOTPEmail(recipientEmail, otp) {
    const mailOptions = {
        from: process.env.OTP_EMAIL,
        to: recipientEmail,
        subject: 'Your OTP Code (Valid for 60 seconds)',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>OTP Verification</h2>
                <p>Your OTP code is: <strong>${otp}</strong></p>
                <p>This code will expire in 60 seconds. Please use it immediately.</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send OTP email');
    }
}

exports.sendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }
 
    // Sanitize email by converting to lowercase and trimming
    const sanitizedEmail = email.toLowerCase().trim();

    try {
        // Check if user exists
        const checkUserQuery = "SELECT user_id, email FROM users WHERE email = '" + sanitizedEmail + "'";
        const userExists = await executeQuery(checkUserQuery);

        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'This email is not registered',
            });
        }

        const user_id = userExists[0].user_id;

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the OTP
        const saltRounds = 10;
        const hashedOTP = await bcrypt.hash(otp, saltRounds);

        // Delete any existing OTP for this email
        const deleteQuery = `DELETE FROM OTP_tracker WHERE email = '${sanitizedEmail}' AND user_id = '${user_id}'`;
        await executeQuery(deleteQuery);

        // Insert new hashed OTP
        const insertOtpQuery = `
            INSERT INTO OTP_tracker (email, user_id, OTP, OTP_disable, created_at, updated_at, expires_at)
            VALUES ('${sanitizedEmail}', '${user_id}', '${hashedOTP}', false, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP() + INTERVAL 60 SECOND)
        `;

        await executeQuery(insertOtpQuery);

        // Send OTP via email
        try {
            await sendOTPEmail(email, otp);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email',
                error: emailError.message
            });
        }

        res.status(200).json({
            success: true,
            hashedOTP: hashedOTP,
            message: 'OTP generated and sent successfully. Valid for 60 seconds.',
        });
    } catch (error) {
        console.error('Error in sendOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating OTP',
            error: error.message
        });
    }
};