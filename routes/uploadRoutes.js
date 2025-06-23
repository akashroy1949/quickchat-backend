const express = require('express');
const multer = require('multer');
const path = require('path');
const { saveFileMetadata, uploadFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

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

const upload = multer({ 
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types for now, but you can add restrictions here
        cb(null, true);
    }
});

/**
 * @route   POST /api/uploads/file
 * @desc    Upload a single file and return URL
 * @access  Private
 */
router.post('/file', protect, upload.single('file'), uploadFile);

/**
 * @route   POST /api/uploads
 * @desc    Upload a single file and return URL (alternative endpoint)
 * @access  Private
 */
router.post('/', protect, upload.single('file'), uploadFile);

// Route to handle multiple file uploads (existing functionality)
router.post('/upload', upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Save metadata to MongoDB and return file URLs
        const metadataPromises = files.map(async (file) => {
            const metadata = await saveFileMetadata(file);
            return {
                ...metadata.toObject(),
                fileUrl: `/uploads/${file.filename}`
            };
        });
        const results = await Promise.all(metadataPromises);

        res.status(200).json({ 
            message: 'Files uploaded successfully', 
            files: results 
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
