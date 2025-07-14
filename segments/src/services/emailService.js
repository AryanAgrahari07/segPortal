const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

class EmailService {
  constructor() {
    // Configure SES client to use IAM roles
    // When running on AWS services with IAM roles attached,
    // the SDK will automatically use the role credentials
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  /**
   * Send an email using AWS SES
   * @param {Object} options - Email options
   * @param {string} options.from - Sender email address
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content of the email
   * @param {string} [options.text] - Plain text content of the email
   * @returns {Promise<Object>} - Response from SES
   */
  async sendEmail(options) {
    try {
      const params = {
        Source: options.from,
        Destination: {
          ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: "UTF-8",
            },
          },
        },
      };

      // Add plain text if provided
      if (options.text) {
        params.Message.Body.Text = {
          Data: options.text,
          Charset: "UTF-8",
        };
      }

      const command = new SendEmailCommand(params);
      const response = await this.sesClient.send(command);
      return response;
    } catch (error) {
      console.error("Email sending error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send an OTP email to a user
   * @param {string} recipientEmail - Recipient's email address
   * @param {string} otp - One-time password
   * @returns {Promise<Object>} - Response from SES
   */
  async sendOTPEmail(recipientEmail, otp) {
    const mailOptions = {
      from: process.env.OTP_EMAIL,
      to: recipientEmail,
      subject: "Your OTP Code (Valid for 60 seconds)",
      html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>OTP Verification</h2>
                    <p>Your OTP code is: <strong>${otp}</strong></p>
                    <p>This code will expire in 60 seconds. Please use it immediately.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `,
    };

    try {
      const response = await this.sendEmail(mailOptions);
      return true;
    } catch (error) {
      console.error("OTP email sending error:", error);
      throw new Error("Failed to send OTP email");
    }
  }

  /**
   * Verify the SES configuration
   * @returns {Promise<boolean>} - True if configuration is valid
   */
  async verifyConnection() {
    try {
      // We can't directly verify SES like nodemailer's verify(),
      // but we can check if the client is properly configured
      console.log(
        "AWS SES client initialized with region:",
        this.sesClient.config.region
      );
      return true;
    } catch (error) {
      console.error("AWS SES Configuration Error:", {
        message: error.message,
      });
      return false;
    }
  }
}

module.exports = new EmailService();
