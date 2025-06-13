// server.js
const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const socketHandler = require("./sockets/socketHandler");
const { nullOrEmpty } = require("./utils/utils,js");
// const helmet = require("helmet"); // Optional: comment out if not needed
const path = require("path");
dotenv.config();

const app = express();
app.use(express.json());
app.use(compression()); // Enable gzip compression for responses
// app.use(helmet()); // Uncomment for security headers in production

// Log the Origin header for every request
app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  next();
});

// CORS configuration: allow only your tunnel domain
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://your-tunnel-domain.com", // Set this to your tunnel domain
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Strict Origin check middleware (blocks disallowed origins)
app.use((req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_URL || "https://your-tunnel-domain.com";
  const requestOrigin = req.headers.origin;
  // Allow requests with no Origin (e.g., curl, Postman, server-to-server), or only allow specific origin
  if ((requestOrigin && (requestOrigin !== allowedOrigin)) || nullOrEmpty.includes(requestOrigin)) {
    return res.status(403).json({ error: "Forbidden: Origin not allowed" });
  }
  next();
});

// 1. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit if DB connection fails
  });

// 2. Import API routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoutes = require('./routes/uploadRoutes');

// 3. Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/messages", messageRoutes);
app.use('/api/uploads', uploadRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/ping", (req, res) => {
  // Get client IP, considering proxy headers
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  res.status(200).json({ status: "ok", message: `Pinged`, from: clientIp });
  console.log(`Pinged from ${clientIp} at ${new Date().toISOString()}`);
});

// 4. Create HTTP server and attach Socket.io
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});


socketHandler(io);

// 6. Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
