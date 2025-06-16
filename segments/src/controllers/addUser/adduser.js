const { executeQuery } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

// Helper function to validate user data
const validateUserData = (data) => {
  if (!data.email || typeof data.email !== 'string') {
    throw new Error('Invalid email');
  }
  
  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Invalid email format');
  }
  
  if (!data.first_name || typeof data.first_name !== 'string') {
    throw new Error('First name is required');
  }
  
  if (!data.last_name || typeof data.last_name !== 'string') {
    throw new Error('Last name is required');
  }
  
  if (data.role && !['admin', 'user'].includes(data.role)) {
    throw new Error('Invalid role. Must be admin, user');
  }
};

// Check if user is admin middleware
exports.isAdmin = async (req, res, next) => {
  try {
    // Get user ID from authenticated session
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user has admin role
    const query = `
      SELECT role 
      FROM users 
      WHERE user_id = ${escapeSQLString(userId)} AND is_active = true
    `;
    
    const result = await executeQuery(query);
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (result[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    // User is admin, proceed to next middleware
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify admin status',
      error: error.message
    });
  }
};

// Add user controller - only accessible by admins
exports.addUser = async (req, res) => {
  try {
    const userData = req.body;
    
    // Validate input data
    validateUserData(userData);
    
    // Check if email already exists
    const checkQuery = `
      SELECT email 
      FROM users 
      WHERE email = ${escapeSQLString(userData.email.toLowerCase().trim())}
    `;
    
    const existingUser = await executeQuery(checkQuery);
    
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Generate user ID
    const userId = uuidv4();
    
    // Prepare user data
    const email = userData.email.toLowerCase().trim();
    const firstName = userData.first_name.trim();
    const lastName = userData.last_name.trim();
    const role = userData.role || 'user';
    const isActive = userData.is_active !== undefined ? userData.is_active : true;
    
    // Insert new user
    const insertQuery = `
      INSERT INTO users (
        user_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${escapeSQLString(userId)},
        ${escapeSQLString(email)},
        ${escapeSQLString(firstName)},
        ${escapeSQLString(lastName)},
        ${escapeSQLString(role)},
        ${isActive},
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP()
      )
    `;
    
    await executeQuery(insertQuery);
    
    // Return success without exposing password hash
    return res.status(201).json({
      success: true,
      data: {
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        is_active: isActive
      },
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error adding user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add user',
      error: error.message
    });
  }
};

// Get all users - admin only
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        user_id, 
        email, 
        first_name, 
        last_name, 
        role, 
        is_active, 
        created_at, 
        updated_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    
    const users = await executeQuery(query);
    
    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Update user status (activate/deactivate) - admin only
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    
    if (is_active === undefined || typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active field is required and must be a boolean'
      });
    }
    
    const query = `
      UPDATE users
      SET is_active = ${is_active},
          updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = ${escapeSQLString(userId)}
    `;
    
    await executeQuery(query);
    
    // Get updated user
    const updatedUserQuery = `
      SELECT 
        user_id, 
        email, 
        first_name, 
        last_name, 
        role, 
        is_active, 
        created_at, 
        updated_at 
      FROM users 
      WHERE user_id = ${escapeSQLString(userId)}
    `;
    
    const updatedUser = await executeQuery(updatedUserQuery);
    
    if (!updatedUser || updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found after update'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: updatedUser[0],
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

// Update user role - admin only
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (admin, user)'
      });
    }
    
    const query = `
      UPDATE users
      SET role = ${escapeSQLString(role)},
          updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = ${escapeSQLString(userId)}
    `;
    
    await executeQuery(query);
    
    // Get updated user
    const updatedUserQuery = `
      SELECT 
        user_id, 
        email, 
        first_name, 
        last_name, 
        role, 
        is_active, 
        created_at, 
        updated_at 
      FROM users 
      WHERE user_id = ${escapeSQLString(userId)}
    `;
    
    const updatedUser = await executeQuery(updatedUserQuery);
    
    if (!updatedUser || updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found after update'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: updatedUser[0],
      message: 'User role updated successfully'
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
};
