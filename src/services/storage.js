const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

// ============ MongoDB Setup ============

let isMongoConnected = false;

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  prompt: { type: String, required: true },
  type: { type: String, enum: ['image', 'video'], required: true },
  provider: { type: String, required: true },
  providerName: { type: String },
  price: { type: Number, required: true },
  paymentHash: { type: String, default: '' },
  mediaUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Connect to MongoDB
async function connectMongoDB() {
  if (isMongoConnected) return true;

  if (!config.mongodb.uri) {
    console.log('[Storage] MongoDB URI not configured - using mock storage');
    return false;
  }

  try {
    await mongoose.connect(config.mongodb.uri);
    isMongoConnected = true;
    console.log('[Storage] MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('[Storage] MongoDB connection error:', error.message);
    return false;
  }
}

// Initialize connection
connectMongoDB();

// ============ S3 Setup (opcional) ============

const isAWSConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
let s3Client = null;

if (isAWSConfigured) {
  s3Client = new S3Client({ region: config.aws.region });
  console.log('[Storage] S3 client initialized');
} else {
  console.log('[Storage] S3 not configured - using mock URLs');
}

// ============ Mock Storage (fallback) ============

const mockTransactions = new Map();

// ============ Storage Functions ============

/**
 * Sube contenido generado a S3
 * @param {Object} params - { data, type, transactionId }
 * @returns {string} - URL presignada del contenido
 */
async function upload({ data, type, transactionId }) {
  const extension = type === 'video' ? 'mp4' : 'png';
  const contentType = type === 'video' ? 'video/mp4' : 'image/png';
  const key = `generated/${transactionId}.${extension}`;

  // Mock storage si S3 no está configurado
  if (!isAWSConfigured || !s3Client) {
    console.log(`[Storage] Mock upload: ${key}`);
    return `https://mock-storage.ultrapay.local/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: data,
    ContentType: contentType
  });

  await s3Client.send(command);

  // Generar URL presignada (válida por 1 hora)
  const getCommand = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key
  });

  const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

  return presignedUrl;
}

/**
 * Guarda la transacción en MongoDB
 */
async function saveTransaction(transaction) {
  // Intentar conectar a MongoDB si no está conectado
  const connected = await connectMongoDB();

  if (!connected) {
    // Fallback a mock storage
    console.log(`[Storage] Mock save transaction: ${transaction.transactionId}`);
    mockTransactions.set(transaction.transactionId, {
      ...transaction,
      createdAt: transaction.createdAt || new Date().toISOString()
    });
    return;
  }

  const doc = new Transaction({
    transactionId: transaction.transactionId,
    prompt: transaction.prompt,
    type: transaction.type,
    provider: transaction.provider,
    providerName: transaction.providerName || transaction.provider,
    price: transaction.price,
    paymentHash: transaction.paymentHash || '',
    mediaUrl: transaction.mediaUrl,
    createdAt: transaction.createdAt || new Date()
  });

  await doc.save();
  console.log(`[Storage] Transaction saved: ${transaction.transactionId}`);
}

/**
 * Obtiene una transacción por ID
 */
async function getTransaction(transactionId) {
  const connected = await connectMongoDB();

  if (!connected) {
    return mockTransactions.get(transactionId) || null;
  }

  const doc = await Transaction.findOne({ transactionId });

  if (!doc) return null;

  return {
    transactionId: doc.transactionId,
    prompt: doc.prompt,
    type: doc.type,
    provider: doc.provider,
    providerName: doc.providerName,
    price: doc.price,
    paymentHash: doc.paymentHash,
    mediaUrl: doc.mediaUrl,
    createdAt: doc.createdAt.toISOString()
  };
}

/**
 * Obtiene todas las transacciones (para historial)
 */
async function getAllTransactions(limit = 50) {
  const connected = await connectMongoDB();

  if (!connected) {
    return Array.from(mockTransactions.values()).slice(0, limit);
  }

  const docs = await Transaction.find()
    .sort({ createdAt: -1 })
    .limit(limit);

  return docs.map(doc => ({
    transactionId: doc.transactionId,
    prompt: doc.prompt,
    type: doc.type,
    provider: doc.provider,
    providerName: doc.providerName,
    price: doc.price,
    paymentHash: doc.paymentHash,
    mediaUrl: doc.mediaUrl,
    createdAt: doc.createdAt.toISOString()
  }));
}

module.exports = {
  upload,
  saveTransaction,
  getTransaction,
  getAllTransactions,
  connectMongoDB
};
