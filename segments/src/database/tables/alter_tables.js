// const alterCommands = {
//     checkConstraints: {
//         users: `
//         SHOW TBLPROPERTIES users
//         `,
//         otp_tracker: `
//             SHOW TBLPROPERTIES otp_tracker
//         `,
//     },
//     users: `
//         -- Add role constraint
//         ALTER TABLE users 
//         ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));
//     `,
//     otp_tracker: `
//         -- Add foreign key constraint to users table
//         ALTER TABLE otp_tracker 
//         ADD CONSTRAINT fk_otp_tracker_user 
//         FOREIGN KEY (user_id) REFERENCES users(user_id);
//     `,
// };

// Function to execute alter command
// const executeAlterCommands = async (connection) => {
//     try {
//         // Check and add users constraint
//         const userConstraintExists = await connection.query(alterCommands.checkConstraints.users);
//         if (userConstraintExists[0].count === 0) {
//             await connection.query(alterCommands.users);
//             console.log('✅ Users table role constraint added');
//         } else {
//             console.log('ℹ️ Users table role constraint already exists, skipping...');
//         }

//         // Check and add OTP tracker constraint
//         const otpConstraintExists = await connection.query(alterCommands.checkConstraints.otp_tracker);
//         if (otpConstraintExists[0].count === 0) {
//             await connection.query(alterCommands.otp_tracker);
//             console.log('✅ OTP_tracker table foreign key constraint added');
//         } else {
//             console.log('ℹ️ OTP_tracker foreign key constraint already exists, skipping...');
//         }

//         console.log('✅ All table alterations completed successfully');
//     } catch (error) {
//         console.error('⚠️ Error during table alterations:', error.message);
//         // Log error but don't throw to prevent server crash
//     }
// };

// module.exports = {
//     alterCommands,
//     executeAlterCommands
// }; 
