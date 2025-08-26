import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';
import { z } from 'zod';
import sharp from 'sharp';

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'quick-messages');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `quick-message-${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload image endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Optimize image with sharp
    const optimizedPath = path.join(uploadDir, `optimized-${req.file.filename}`);
    
    await sharp(req.file.path)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    // Delete original file
    fs.unlinkSync(req.file.path);

    // Return the URL path that can be used to access the image
    const imageUrl = `/uploads/quick-messages/optimized-${req.file.filename}`;
    
    res.json({ 
      success: true, 
      imageUrl,
      fullPath: optimizedPath
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get all quick messages
router.get('/', async (req, res) => {
  try {
    const messages = await storage.getMensagensRapidas();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching quick messages:', error);
    res.status(500).json({ error: 'Failed to fetch quick messages' });
  }
});

// Create quick message
router.post('/', async (req, res) => {
  try {
    const schema = z.object({
      titulo: z.string(),
      texto: z.string(),
      tipo: z.string().default('suporte'),
      categoria: z.string().optional(),
      imagemUrl: z.string().optional().nullable(),
      ativo: z.boolean().default(true),
      ordem: z.number().default(0),
      teclaAtalho: z.string().optional(),
      variavel: z.boolean().default(false)
    });

    const data = schema.parse(req.body);
    const message = await storage.createMensagemRapida(data);
    res.json(message);
  } catch (error) {
    console.error('Error creating quick message:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create quick message' });
  }
});

// Reorder messages
router.put('/reorder', async (req, res) => {
  try {
    const schema = z.object({
      messages: z.array(z.object({
        id: z.number(),
        ordem: z.number()
      }))
    });

    const data = schema.parse(req.body);
    
    // Update each message's order
    for (const message of data.messages) {
      await storage.updateMensagemRapida(message.id, { ordem: message.ordem });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering messages:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to reorder messages' });
  }
});

// Update quick message
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      titulo: z.string(),
      texto: z.string(),
      tipo: z.string(),
      categoria: z.string().optional(),
      imagemUrl: z.string().optional().nullable(),
      ativo: z.boolean(),
      ordem: z.number(),
      teclaAtalho: z.string().optional(),
      variavel: z.boolean()
    });

    const data = schema.parse(req.body);
    const message = await storage.updateMensagemRapida(id, data);
    res.json(message);
  } catch (error) {
    console.error('Error updating quick message:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update quick message' });
  }
});

// Delete quick message
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get the message to check if it has an image
    const message = await storage.getMensagemRapidaById(id);
    
    if (message?.imagemUrl) {
      // Delete the image file if it exists
      const imagePath = path.join(process.cwd(), message.imagemUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await storage.deleteMensagemRapida(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quick message:', error);
    res.status(500).json({ error: 'Failed to delete quick message' });
  }
});

export default router;