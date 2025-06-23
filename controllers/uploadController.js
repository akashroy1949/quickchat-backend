const mongoose = require('mongoose');
const FileMetadata = require('../models/FileMetadata');

// Save file metadata to MongoDB
const saveFileMetadata = async (file) => {
    const metadata = new FileMetadata({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        uploadDate: new Date(),
    });
    return await metadata.save();
};

/**
 * @desc    Upload a single file
 * @route   POST /api/uploads/file
 * @access  Private
 */
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const metadata = await saveFileMetadata(req.file);

        res.status(200).json({
            message: 'File uploaded successfully',
            fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            metadata
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { saveFileMetadata, uploadFile };
