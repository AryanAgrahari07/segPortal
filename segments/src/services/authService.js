const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { executeQuery, executeAppSchemaQuery } = require('../database/database');

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

class AuthService {
  // Generate access token (short-lived)
  generateAccessToken(user) {
    return jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' } // 30m expiry balancing security and user experience
    );
  }

  // Generate refresh token (long-lived)  - 12 hours
  generateRefreshToken() {
    return jwt.sign({ token_id: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '12h',
    });
  }

  // Create new session in database
  async createSession(userId, refreshToken, deviceInfo, ipAddress) {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12); // 12 hours from now

    // Deactivate all existing sessions for this user
    const deactivateQuery = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE user_id = ${escapeSQLString(userId)}
    `;
    await executeAppSchemaQuery(deactivateQuery);

    // Create new session
    const query = `
      INSERT INTO user_sessions (
        session_id, user_id, refresh_token, device_info, 
        ip_address, expires_at, is_active
      )
      VALUES (
        ${escapeSQLString(sessionId)},
        ${escapeSQLString(userId)},
        ${escapeSQLString(refreshToken)},
        ${escapeSQLString(JSON.stringify(deviceInfo))},
        ${escapeSQLString(ipAddress)},
        ${escapeSQLString(expiresAt.toISOString())},
        true
      )
    `;

    await executeAppSchemaQuery(query);

    // Get the created session
    const getSessionQuery = `
      SELECT * FROM user_sessions 
      WHERE session_id = ${escapeSQLString(sessionId)}
    `;
    const result = await executeAppSchemaQuery(getSessionQuery);

    return result[0];
  }

  // Update session with new refresh token
  async updateSession(sessionId, newRefreshToken) {
    const query = `
      UPDATE user_sessions 
      SET refresh_token = ${escapeSQLString(newRefreshToken)},
          updated_at = CURRENT_TIMESTAMP(),
          expires_at = CURRENT_TIMESTAMP() + INTERVAL 12 HOUR
      WHERE session_id = ${escapeSQLString(sessionId)}
    `;

    await executeAppSchemaQuery(query);
  }

  // Validate refresh token and return session info
  async validateRefreshToken(token) {
    try {
      // Verify token signature
      jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      // Check if token exists and is active in database
      const query = `
        SELECT us.*, u.email, u.first_name, u.last_name, u.role
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.refresh_token = ${escapeSQLString(token)}
        AND us.is_active = true
        AND us.expires_at > CURRENT_TIMESTAMP()
      `;

      const result = await executeAppSchemaQuery(query);

      if (!result || result.length === 0) {
        throw new Error('Invalid refresh token');
      }

      return result[0];
    } catch (error) {
      console.error('Validate refresh token error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  // Invalidate a session
  async invalidateSession(sessionId) {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE session_id = ${escapeSQLString(sessionId)}
    `;
    await executeAppSchemaQuery(query);
  }
}

module.exports = new AuthService(); 