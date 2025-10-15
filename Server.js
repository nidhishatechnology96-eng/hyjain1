import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import { readFileSync } from 'fs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();

// --- FIREBASE ADMIN SETUP ---
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.firestore();
const productsCollection = db.collection('products');


// --- CLOUDINARY CONFIGURATION ---
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


// --- EXPRESS APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());


// --- API ROUTES ---

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

// --- NEW: GET ALL USERS ROUTE ---
app.get("/api/users", async (req, res) => {
    try {
        const userRecords = await admin.auth().listUsers();
        const users = userRecords.users.map(user => ({
            id: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0], // Fallback name
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
        const productRef = productsCollection.doc(id);
        await productRef.update(updatedData);
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


// In your order controller file
const getOrderById = async (req, res) => {
  try {
    // This is the line that needs to be perfect.
    // Is the field name in your schema 'user' or something else like 'customer'?
    const order = await Order.findById(req.params.id).populate('user', 'name email mobile');

    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};