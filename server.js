const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

// In-memory session store (SessionName -> PIN)
const sessions = {};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Configuration (with duplicate renaming)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { session, pin } = req.body;
        if (!session || !pin) return cb(new Error('Missing session or pin'));

        if (!sessions[session]) {
            sessions[session] = pin; // Create new session
        } else if (sessions[session] !== pin) {
            return cb(new Error('Invalid PIN')); // Unauthorized
        }

        const sessionDir = path.join(uploadsDir, session);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
        const { session } = req.body;
        const sessionDir = path.join(uploadsDir, session);
        
        let fileName = file.originalname;
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        let counter = 1;

        // Auto-rename if file exists
        while (fs.existsSync(path.join(sessionDir, fileName))) {
            fileName = `${base}_${counter}${ext}`;
            counter++;
        }
        cb(null, fileName);
    }
});

const upload = multer({ storage });

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Routes
app.post('/upload', upload.array('files'), (req, res) => {
    res.sendStatus(200);
});

app.get('/files', (req, res) => {
    const { session, pin } = req.query;
    
    if (!sessions[session] || sessions[session] !== pin) {
        return res.status(403).json({ error: 'Invalid Session or PIN' });
    }

    const sessionDir = path.join(uploadsDir, session);
    if (!fs.existsSync(sessionDir)) {
        return res.json({ files: [] });
    }

    const files = fs.readdirSync(sessionDir).map(f => {
        const stats = fs.statSync(path.join(sessionDir, f));
        return { name: f, size: stats.size };
    });
    
    res.json({ files });
});

app.get('/download', (req, res) => {
    const { session, pin, file } = req.query;
    
    if (!sessions[session] || sessions[session] !== pin) {
        return res.status(403).send('Unauthorized');
    }

    const filePath = path.join(uploadsDir, session, file);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.post('/delete', (req, res) => {
    const { session, pin, file } = req.body;
    
    if (!sessions[session] || sessions[session] !== pin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const filePath = path.join(uploadsDir, session, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.get('/storage', async (req, res) => {
    try {
        const stat = await fs.promises.statfs(__dirname);
        const freeSpaceGB = (stat.bavail * stat.bsize) / (1024 * 1024 * 1024);
        res.json({ free: `${freeSpaceGB.toFixed(2)} GB` });
    } catch (err) {
        res.json({ free: 'Unavailable' });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`> SERVER ONLINE: Listening on port ${PORT}`);
    console.log(`> Run 'npm install express multer' if not installed.`);
});
