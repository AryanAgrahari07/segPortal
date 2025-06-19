const express = require("express");
const app = express();
require("dotenv").config();
const os = require("os");
const hostname = os.hostname();
const cors = require("cors");
const PORT = process.env.PORT || 4444;
const cookieParser = require("cookie-parser");
const { connect } = require("./src/database/database.js");
const DatabaseInitializer = require("./src/database/init");
const { sanitizeInput } = require("./src/middleware/security.js");

// if (!process.env.FRONTEND) {
//     throw new Error("FRONTEND URL not defined in environment variables");
//   }

app.use(
  cors({
    origin: process.env.FRONTEND,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json()); // Make sure this comes before routes
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(sanitizeInput); // sanitization middleware

const routesPath = require("./src/routes/routes.js");
app.use("/", routesPath);

const startServer = async () => {
  try {
    // Connect to database
    await connect();

    // Initialize database tables
    await DatabaseInitializer.initializeDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

startServer();
