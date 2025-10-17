import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import { readFileSync } from 'fs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';

dotenv.config();

// --- FIREBASE ADMIN SETUP ---
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.firestore();
const productsCollection = db.collection('products');

// --- CLOUDINARY CONFIG (FOR IMAGES ONLY) ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hyjain-products',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp']
    }
});
const imageUpload = multer({ storage: imageStorage });

// --- MULTER SETUP FOR UPLOADCARE (HANDLES FILES IN MEMORY) ---
const memoryStorage = multer.memoryStorage();
const fileUpload = multer({ storage: memoryStorage });

// --- EXPRESS APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// =================================================================
// --- API ROUTES ---
// =================================================================

// --- IMAGE UPLOAD ROUTE (Stays the same, uses Cloudinary) ---
app.post('/api/upload-image', imageUpload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded.' });
        }
        res.status(200).json({ imageUrl: req.file.path });
    } catch (error) {
        console.error("Cloudinary Image Upload Error:", error);
        res.status(500).json({ error: 'Image upload failed: ' + error.message });
    }
});

// --- FILE UPLOAD ROUTE (NEW AND CORRECTED, uses Uploadcare REST API) ---
app.post('/api/upload-file', fileUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }

    try {
        const formData = new FormData();
        formData.append('UPLOADCARE_PUB_KEY', '8d5189298f8465f7079f'); // Your public key
        formData.append('UPLOADCARE_STORE', 'auto');
        formData.append('file', req.file.buffer, { filename: req.file.originalname });

        const response = await axios.post('https://upload.uploadcare.com/base/', formData, {
            headers: formData.getHeaders()
        });

        if (response.data && response.data.file) {
            res.status(200).json({ fileUUID: response.data.file });
        } else {
            throw new Error('Uploadcare response did not contain a file UUID.');
        }

    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("Uploadcare API Error:", errorMessage);
        res.status(500).json({ error: 'File upload to Uploadcare failed.' });
    }
});

// --- Other existing routes (no changes needed) ---
app.get("/api/products", async (req, res) => {
  try {
    const snapshot = await productsCollection.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products: " + err.message });
  }
});

app.get("/api/users", async (req, res) => {
    try {
        const userRecords = await admin.auth().listUsers();
        const users = userRecords.users.map(user => ({
            id: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
        }));
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users: " + err.message });
    }
});

app.post("/api/products", async (req, res) => {
  try {
    const newProduct = req.body;
    const docRef = await productsCollection.add(newProduct);
    res.status(201).json({ id: docRef.id, ...newProduct });
  } catch (err) {
    res.status(500).json({ error: "Failed to add product: " + err.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        await db.collection('products').doc(id).update(updatedData);
        res.status(200).json({ id, ...updatedData });
    } catch (err) {
        res.status(500).json({ error: "Failed to update product: " + err.message });
    }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('products').doc(id).delete();
        res.status(200).json({ message: `Product with id ${id} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete product: " + err.message });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));