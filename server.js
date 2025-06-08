// server.js
const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
// const helmet = require("helmet"); // Optional: comment out if not needed
const path = require("path");
dotenv.config();

const app = express();
app.use(express.json());
app.use(compression()); // Enable gzip compression for responses
// app.use(helmet()); // Uncomment for security headers in production

// Optimized CORS: allow all origins, credentials, and common headers
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

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

// 5. Import and initialize socket handler
const socketHandler = require("./sockets/socketHandler");
socketHandler(io);

// 6. Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
