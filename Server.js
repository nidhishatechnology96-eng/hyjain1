// --- 1. IMPORTS ---
// Sab kuch import statement ka use karke import karein
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import { readFileSync } from 'fs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// --- 2. CONFIGURATIONS ---
dotenv.config();

// Firebase Admin Setup
// Yeh code theek hai, lekin sunishchit karein ki Render par "Secret File" set hai
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.firestore();
const productsCollection = db.collection('products');

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hyjain-products',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp']
    }
});
const upload = multer({ storage: storage });


// --- 3. EXPRESS APP SETUP & MIDDLEWARE ---
// app ko sirf EK BAAR declare karein
const app = express();

// CORS ko yahan configure karein
const corsOptions = {
    origin: "https://hyjain.netlify.app" // Aapki Netlify site ka URL
};
app.use(cors(corsOptions));

// JSON bodies ko parse karne ke liye middleware
app.use(express.json());


// --- 4. API ROUTES ---

// Image Upload Route
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded.' });
        }
        res.status(200).json({ imageUrl: req.file.path });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: 'Image upload failed: ' + error.message });
    }
});

// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const snapshot = await productsCollection.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products: " + err.message });
  }
});

// GET ALL USERS ROUTE
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

// ADD a new product
app.post("/api/products", async (req, res) => {
  try {
    const newProduct = req.body;
    const docRef = await productsCollection.add(newProduct);
    res.status(201).json({ id: docRef.id, ...newProduct });
  } catch (err) {
    res.status(500).json({ error: "Failed to add product: " + err.message });
  }
});

// UPDATE a product
app.put("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        await productsCollection.doc(id).update(updatedData);
        res.status(200).json({ id, ...updatedData });
    } catch (err) {
        res.status(500).json({ error: "Failed to update product: " + err.message });
    }
});

// DELETE a product
app.delete("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await productsCollection.doc(id).delete();
        res.status(200).json({ message: `Product with id ${id} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete product: " + err.message });
    }
});


// --- 5. START THE SERVER ---
const PORT = process.env.PORT || 10000; // Render aksar 10000 port use karta hai
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));