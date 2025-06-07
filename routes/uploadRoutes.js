const express = require('express');
const multer = require('multer');
const path = require('path');
const { saveFileMetadata } = require('../controllers/uploadController');

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

// Route to handle multiple file uploads
router.post('/upload', upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Save metadata to MongoDB
        const metadataPromises = files.map(file => saveFileMetadata(file));
        const metadata = await Promise.all(metadataPromises);

        res.status(200).json({ message: 'Files uploaded successfully', metadata });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
