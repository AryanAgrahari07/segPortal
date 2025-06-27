const authService = require('../../services/authService');

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshtoken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    try {
      const session = await authService.validateRefreshToken(refreshToken);
      
      if (!session) {
          // Clear cookies
          res.clearCookie('refreshtoken');
          res.clearCookie('sessionid');

          return res.status(401).json({
            success: false,
            message: "Invalid refresh token",
          });
        }
    
      // Generate new tokens
      const accessToken = authService.generateAccessToken({
        user_id: session.user_id,
        email: session.email,
      });
      const newRefreshToken = authService.generateRefreshToken();

      // Update session with new refresh token
      await authService.updateSession(session.session_id, newRefreshToken);

    // Set new refresh token cookie
    if (process.env.NODE_ENV === 'development') {
      res.cookie('refreshtoken', newRefreshToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        domain: 'localhost',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    } else {
      res.cookie('refreshtoken', newRefreshToken, {
        httpOnly: false,
        secure: false,
        sameSite: process.env.SAME_SITE,
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        maxAge: 7 *24 * 60 * 60 * 1000, // 7 days
      });
    }

      return res.status(200).json({
        success: true,
        token: accessToken,
        data: {
          email: session.email,
          role: session.role,
        },
      });
    } catch (tokenError) {
      // Handle token validation errors
      if (tokenError.name === 'TokenExpiredError') {
        // Clear cookies
        res.clearCookie('refreshtoken');
        res.clearCookie('sessionid');

        return res.status(401).json({
          success: false,
          message: 'Refresh token has expired. Please log in again.',
          error: 'token_expired'
        });
      }
      
      // Other token validation errors
      // Clear cookies
      res.clearCookie('refreshtoken');
      res.clearCookie('sessionid');

      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'invalid_token'
      });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    // Clear cookies
    res.clearCookie('refreshtoken');
    res.clearCookie('sessionid');

    return res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
      error: 'server_error'
    });
  }
}; 