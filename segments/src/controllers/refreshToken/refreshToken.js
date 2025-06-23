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

    const session = await authService.validateRefreshToken(refreshToken);
    
    if (!session) {
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
        secure: true,
        sameSite: process.env.SAME_SITE || "None",
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
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
}; 