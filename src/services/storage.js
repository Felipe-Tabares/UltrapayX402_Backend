const mongoose = require('mongoose');
const config = require('../config');

// Estado de conexión
let isConnected = false;

/**
 * Conectar a MongoDB
 */
async function connectDB() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully');
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    throw error;
  }
}

// Schema para transacciones
const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  prompt: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  providerName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  paymentHash: {
    type: String,
    default: ''
  },
  mediaUrl: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Schema para historial de usuario (por wallet)
const userHistorySchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  totalGenerations: {
    type: Number,
    default: 0
  },
  lastGeneration: {
    type: Date
  }
}, {
  timestamps: true
});

// Modelos
const Transaction = mongoose.model('Transaction', transactionSchema);
const UserHistory = mongoose.model('UserHistory', userHistorySchema);

/**
 * Guarda la transacción en MongoDB
 */
async function saveTransaction(transaction) {
  await connectDB();

  const doc = new Transaction({
    transactionId: transaction.transactionId,
    prompt: transaction.prompt,
    type: transaction.type,
    provider: transaction.provider,
    providerName: transaction.providerName || transaction.provider,
    price: transaction.price,
    paymentHash: transaction.paymentHash || '',
    mediaUrl: transaction.mediaUrl,
    walletAddress: transaction.walletAddress || '',
    status: 'completed',
    createdAt: transaction.createdAt || new Date()
  });

  await doc.save();
  console.log(`[MongoDB] Transaction saved: ${transaction.transactionId}`);

  // Actualizar historial del usuario si tiene wallet
  if (transaction.walletAddress) {
    await UserHistory.findOneAndUpdate(
      { walletAddress: transaction.walletAddress },
      {
        $inc: {
          totalSpent: transaction.price,
          totalGenerations: 1
        },
        $set: {
          lastGeneration: new Date()
        }
      },
      { upsert: true, new: true }
    );
  }

  return doc;
}

/**
 * Obtiene una transacción por ID
 */
async function getTransaction(transactionId) {
  await connectDB();

  const doc = await Transaction.findOne({ transactionId });
  if (!doc) {
    return null;
  }

  return {
    transactionId: doc.transactionId,
    prompt: doc.prompt,
    type: doc.type,
    provider: doc.provider,
    providerName: doc.providerName,
    price: doc.price,
    paymentHash: doc.paymentHash,
    mediaUrl: doc.mediaUrl,
    walletAddress: doc.walletAddress,
    status: doc.status,
    createdAt: doc.createdAt
  };
}

/**
 * Obtiene historial de transacciones por wallet
 */
async function getTransactionsByWallet(walletAddress, limit = 50) {
  await connectDB();

  const transactions = await Transaction.find({ walletAddress })
    .sort({ createdAt: -1 })
    .limit(limit);

  return transactions.map(doc => ({
    transactionId: doc.transactionId,
    prompt: doc.prompt,
    type: doc.type,
    provider: doc.provider,
    providerName: doc.providerName,
    price: doc.price,
    mediaUrl: doc.mediaUrl,
    createdAt: doc.createdAt
  }));
}

/**
 * Obtiene estadísticas del usuario
 */
async function getUserStats(walletAddress) {
  await connectDB();

  const stats = await UserHistory.findOne({ walletAddress });
  if (!stats) {
    return {
      totalSpent: 0,
      totalGenerations: 0,
      lastGeneration: null
    };
  }

  return {
    totalSpent: stats.totalSpent,
    totalGenerations: stats.totalGenerations,
    lastGeneration: stats.lastGeneration
  };
}

/**
 * Upload placeholder - en producción usar S3 o Cloudinary
 * Por ahora retorna una URL de placeholder
 */
async function upload({ data, type, transactionId }) {
  // TODO: Implementar subida real a S3 o Cloudinary
  // Por ahora retornamos una URL de placeholder
  const extension = type === 'video' ? 'mp4' : 'png';

  // Placeholder URLs para demostración
  const placeholderUrls = {
    image: 'https://placehold.co/1024x1024/7c3aed/white?text=AI+Generated',
    video: 'https://placehold.co/1920x1080/7c3aed/white?text=AI+Video'
  };

  console.log(`[Storage] Upload placeholder for ${transactionId}.${extension}`);

  return placeholderUrls[type];
}

module.exports = {
  connectDB,
  saveTransaction,
  getTransaction,
  getTransactionsByWallet,
  getUserStats,
  upload,
  Transaction,
  UserHistory
};
