const { executeAppSchemaQuery } = require('../../database/database');
const bcrypt = require('bcrypt');
const emailService = require("../../services/emailService");
require('dotenv').config();

// Verify AWS SES connection on startup, but don't exit if it fails
// This allows the application to start even if email service is temporarily unavailable
emailService
  .verifyConnection()
  .then((isConnected) => {
    if (isConnected) {
      console.log("✅ AWS SES connection verified");
    } else {
      console.warn("⚠️ AWS SES connection verification failed");
      console.warn("Email functionality may not work correctly");
    }
  })
  .catch((error) => {
    console.warn("⚠️ AWS SES Connection Error:", {
      message: error.message,
    });
    console.warn("Email functionality may not work correctly");
    console.warn("If using IAM roles, ensure the role has SES permissions");
  });


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
        
        let userExists;
        try {
            userExists = await executeAppSchemaQuery(checkUserQuery);
        } catch (dbError) {
            console.error('Database error checking user:', dbError);
            return res.status(503).json({
                success: false,
                message: 'Database service unavailable, please try again later',
                error: 'database_error'
            });
        }

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
        try {
            const deleteQuery = `DELETE FROM OTP_tracker WHERE email = '${sanitizedEmail}' AND user_id = '${user_id}'`;
            await executeAppSchemaQuery(deleteQuery);
        } catch (deleteError) {
            console.error('Error deleting existing OTP:', deleteError);
            // Continue execution even if delete fails
        }

        // Insert new hashed OTP
        try {
            const insertOtpQuery = `
                INSERT INTO OTP_tracker (email, user_id, OTP, OTP_disable, created_at, updated_at, expires_at)
                VALUES ('${sanitizedEmail}', '${user_id}', '${hashedOTP}', false, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP() + INTERVAL 60 SECOND)
            `;

            await executeAppSchemaQuery(insertOtpQuery);
        } catch (insertError) {
            console.error('Error inserting OTP:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate OTP',
                error: 'database_error'
            });
        }

        // Send OTP via email
        try {
            await emailService.sendOTPEmail(email, otp);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);

            if (emailError.message && emailError.message.includes("credentials")) {
                console.error(
                  "AWS credentials issue detected. If using IAM roles, check role permissions for SES access"
                );
                return res.status(500).json({
                  success: false,
                  message: "Email service configuration error",
                  error: "aws_credentials_error",
                });
              }
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email',
                error: emailError.message
            });
        }

        res.status(200).json({
            success: true,
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