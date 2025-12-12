const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

// ============ MongoDB Setup ============

let isMongoConnected = false;

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  walletAddress: { type: String, required: true, index: true }, // Wallet del usuario
  prompt: { type: String, required: true },
  type: { type: String, enum: ['image', 'video'], required: true },
  provider: { type: String, required: true },
  providerName: { type: String },
  price: { type: Number, required: true },
  paymentHash: { type: String, default: '' },
  mediaUrl: { type: String },
  isFavorite: { type: Boolean, default: false }, // Marcado como favorito
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
 * Sube contenido generado a S3 o devuelve como base64 data URL
 * @param {Object} params - { data, type, transactionId, mimeType }
 * @returns {string} - URL publica del contenido o data URL
 */
async function upload({ data, type, transactionId, mimeType }) {
  const extension = type === 'video' ? 'mp4' : 'png';
  const contentType = mimeType || (type === 'video' ? 'video/mp4' : 'image/png');
  const key = `generated/${transactionId}.${extension}`;

  // Si S3 no está configurado, devolver como base64 data URL
  if (!isAWSConfigured || !s3Client) {
    console.log(`[Storage] Converting to base64 data URL: ${key}`);
    const base64 = data.toString('base64');
    return `data:${contentType};base64,${base64}`;
  }

  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: data,
    ContentType: contentType
  });

  await s3Client.send(command);

  // Retornar URL publica (el bucket debe tener acceso publico configurado)
  const publicUrl = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

  console.log(`[Storage] Uploaded to S3: ${publicUrl}`);
  return publicUrl;
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
    walletAddress: transaction.walletAddress?.toLowerCase() || '', // Normalizar a lowercase
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
  console.log(`[Storage] Transaction saved: ${transaction.transactionId} for wallet: ${transaction.walletAddress}`);
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
 * Obtiene todas las transacciones de una wallet específica (para historial personal)
 * @param {string} walletAddress - Dirección de la wallet
 * @param {number} limit - Límite de resultados
 */
async function getTransactionsByWallet(walletAddress, limit = 50) {
  const connected = await connectMongoDB();
  const normalizedWallet = walletAddress?.toLowerCase() || '';

  if (!connected) {
    // Filtrar mock transactions por wallet
    return Array.from(mockTransactions.values())
      .filter(tx => tx.walletAddress?.toLowerCase() === normalizedWallet)
      .slice(0, limit);
  }

  const docs = await Transaction.find({ walletAddress: normalizedWallet })
    .sort({ createdAt: -1 })
    .limit(limit);

  return docs.map(doc => ({
    transactionId: doc.transactionId,
    walletAddress: doc.walletAddress,
    prompt: doc.prompt,
    type: doc.type,
    provider: doc.provider,
    providerName: doc.providerName,
    price: doc.price,
    paymentHash: doc.paymentHash,
    mediaUrl: doc.mediaUrl,
    isFavorite: doc.isFavorite || false,
    createdAt: doc.createdAt.toISOString()
  }));
}

/**
 * Toggle favorito de una transaccion
 * @param {string} transactionId - ID de la transaccion
 * @param {string} walletAddress - Wallet del usuario (para verificacion)
 * @returns {Object} - { success, isFavorite }
 */
async function toggleFavorite(transactionId, walletAddress) {
  const connected = await connectMongoDB();
  const normalizedWallet = walletAddress?.toLowerCase() || '';

  if (!connected) {
    // Fallback a mock storage
    const tx = mockTransactions.get(transactionId);
    if (tx && tx.walletAddress?.toLowerCase() === normalizedWallet) {
      tx.isFavorite = !tx.isFavorite;
      return { success: true, isFavorite: tx.isFavorite };
    }
    return { success: false, error: 'Transaction not found' };
  }

  // Buscar la transaccion y verificar que pertenece a la wallet
  const doc = await Transaction.findOne({
    transactionId,
    walletAddress: normalizedWallet
  });

  if (!doc) {
    return { success: false, error: 'Transaction not found or access denied' };
  }

  // Toggle el valor de isFavorite
  doc.isFavorite = !doc.isFavorite;
  await doc.save();

  console.log(`[Storage] Toggle favorite: ${transactionId} -> ${doc.isFavorite}`);
  return { success: true, isFavorite: doc.isFavorite };
}

/**
 * Obtiene todas las transacciones (admin - sin filtro de wallet)
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
    walletAddress: doc.walletAddress,
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
  getTransactionsByWallet,
  getAllTransactions,
  toggleFavorite,
  connectMongoDB
};
