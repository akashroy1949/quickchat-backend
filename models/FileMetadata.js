const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);
