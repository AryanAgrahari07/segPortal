const jwt = require("jsonwebtoken");
const {
  executeQuery,
  executeAppSchemaQuery
} = require("../database/database.js");

const escapeSQLString = (str) => {
    if (str === null || str === undefined) return 'NULL';
    return `'${str.toString().replace(/'/g, "''")}'`;
  };

// Base authentication middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const sessionId = req.cookies.sessionid;

    console.log("token is", token);
    console.log("sessionId is", sessionId);
   
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user has valid session
      const sessionQuery = `
                SELECT us.*, u.is_active 
                FROM user_sessions us
                INNER JOIN users u ON us.user_id = u.user_id
                WHERE us.session_id = ${escapeSQLString(sessionId)} AND us.user_id = ${escapeSQLString(decoded.user_id)} AND us.is_active = true
                AND us.expires_at > CURRENT_TIMESTAMP()
            `;
      const result = await executeAppSchemaQuery(sessionQuery);

      console.log("result is", result);
      if (result.length === 0 || !result[0].is_active) {
        return res.status(401).json({
          success: false,
          message: "Invalid session",
        });
      }
      console.log("decoded is", decoded);

      req.user = decoded;
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  verifyToken,
};
