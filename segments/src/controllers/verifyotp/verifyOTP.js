const { executeQuery } = require('../../database/database');
const bcrypt = require('bcrypt');
const UAParser = require('ua-parser-js');
const authService = require('../../services/authService.js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

exports.verifyOTP = async (req, res) => {
  const { email, OTP } = req.body;

  if (!email || !OTP || typeof email !== 'string' || typeof OTP !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Invalid email or OTP format',
    });
  }

  // Validating email format
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
    });
  }

  // Validating OTP format (6 digits only)
  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(OTP)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP format',
    });
  }

  // Sanitizing inputs
  const sanitizedEmail = email.toLowerCase().trim();

  try {
      // For login, checking if user exists and is active
      const userQuery = `
        SELECT user_id, email, role, first_name, last_name, is_active
        FROM users
        WHERE email = ${escapeSQLString(sanitizedEmail)}
      `;

      const userResult = await executeQuery(userQuery);

      if (!userResult || userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      const user = userResult[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact administrator.',
        });
      }

    // Query to get stored OTP data
    const getOtpQuery = `
      SELECT OTP, expires_at, user_id 
      FROM OTP_tracker
      WHERE email = ${escapeSQLString(email)}
      AND OTP_disable = false
      AND expires_at >= CURRENT_TIMESTAMP()
    `;

    const result = await executeQuery(getOtpQuery);

    if (result && result.length > 0) {
      const storedHashedOTP = result[0].OTP;
      const otpUserId = result[0].user_id;

      // Compare the provided OTP with stored hash
      const isValidOTP = await bcrypt.compare(OTP.toString(), storedHashedOTP);

      if (isValidOTP) {
        // Update OTP_disable to true
        const updateQuery = `
          UPDATE OTP_tracker
          SET OTP_disable = true
          WHERE email = ${escapeSQLString(email)}
          AND user_id = ${escapeSQLString(otpUserId)}
        `;
        await executeQuery(updateQuery);

          // get existing user
          const userQuery = `
            SELECT user_id, email, first_name, last_name, role, is_active
            FROM users
            WHERE email = ${escapeSQLString(sanitizedEmail)} AND is_active = true
          `;
          const userResult = await executeQuery(userQuery);
          const user = userResult[0];

          if (userResult.length === 0) {
            return res.status(404).json({
              success: false,
              message: 'User not found or inactive.',
            });
          }

        // Parse device info from user agent
        const parser = new UAParser(req.headers['user-agent']);
        const deviceInfo = {
          browser: parser.getBrowser(),
          os: parser.getOS(),
          device: parser.getDevice(),
        };

        const query = `
          UPDATE user_sessions 
          SET is_active = false 
          WHERE user_id = ${escapeSQLString(user.user_id)}
        `;
        await executeQuery(query);


        // Generate tokens
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = authService.generateRefreshToken();

        // Create new session
        const session = await authService.createSession(
          user.user_id,
          refreshToken,
          deviceInfo,
          req.ip
        );

        const otpquery = `
          UPDATE OTP_tracker 
          SET OTP_disable = true 
          WHERE email = ${escapeSQLString(sanitizedEmail)}
          AND user_id = ${escapeSQLString(user.user_id)}
        `;
        await executeQuery(otpquery);
        

         // Determine redirect path based on role
        //  let redirectPath = "/dashboard";

        //  switch (user.role.toLowerCase()) {
        //    case "admin":
        //      redirectPath = "/admin";
        //      break;
        //    case "user":
        //      redirectPath = "/dashboard";
        //      break;
        //    default:
        //      redirectPath = "/dashboard";
        //  }


        // Set cookies based on environment
        if (process.env.NODE_ENV === 'development') {
          res.cookie('sessionid', session.session_id, {
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
            domain: 'localhost',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          res.cookie('refreshtoken', refreshToken, {
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
            domain: 'localhost',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        } else {
          res.cookie('sessionid', session.session_id, {
            httpOnly: false,
            secure: true,
            sameSite: process.env.SAME_SITE || "None",
            domain: process.env.COOKIE_DOMAIN,
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          res.cookie('refreshtoken', refreshToken, {
            httpOnly: false,
            secure: true,
            sameSite: process.env.SAME_SITE || "None",
            domain: process.env.COOKIE_DOMAIN,
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        }

        return res.status(200).json({
          success: true,
          token: accessToken,
          data: {
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          },
          cookieSet: true,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP.',
        });
      }
    } else {
      // Check if OTP exists but expired
      const checkExpiredQuery = `
        SELECT created_at, user_id 
        FROM OTP_tracker
        WHERE email = ${escapeSQLString(email)}
        AND OTP_disable = false
        AND expires_at < CURRENT_TIMESTAMP()
      `;

      const expiredResult = await executeQuery(checkExpiredQuery);

      if (expiredResult && expiredResult.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new one.',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP or OTP has already been used.',
      });
    }
  } catch (error) {
    console.error('Error during OTP verification:', error);

    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying OTP.',
      error: error.message,
    });
  }
};
  