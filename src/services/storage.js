const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const config = require('../config');

// Verificar si AWS está configurado
const isAWSConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let s3Client = null;
let dynamoClient = null;

if (isAWSConfigured) {
  s3Client = new S3Client({ region: config.aws.region });
  dynamoClient = new DynamoDBClient({ region: config.aws.region });
  console.log('[Storage] AWS clients initialized');
} else {
  console.log('[Storage] AWS not configured - using mock storage');
}

// Almacenamiento en memoria para desarrollo/testing sin AWS
const mockTransactions = new Map();

/**
 * Sube contenido generado a S3
 * @param {Object} params - { data, type, transactionId }
 * @returns {string} - URL presignada del contenido
 */
async function upload({ data, type, transactionId }) {
  const extension = type === 'video' ? 'mp4' : 'png';
  const contentType = type === 'video' ? 'video/mp4' : 'image/png';
  const key = `generated/${transactionId}.${extension}`;

  // Mock storage si AWS no está configurado
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
 * Guarda la transacción en DynamoDB
 */
async function saveTransaction(transaction) {
  // Mock storage si AWS no está configurado
  if (!isAWSConfigured || !dynamoClient) {
    console.log(`[Storage] Mock save transaction: ${transaction.transactionId}`);
    mockTransactions.set(transaction.transactionId, {
      ...transaction,
      createdAt: transaction.createdAt || new Date().toISOString()
    });
    return;
  }

  const command = new PutItemCommand({
    TableName: config.aws.dynamoTable,
    Item: {
      transactionId: { S: transaction.transactionId },
      prompt: { S: transaction.prompt },
      type: { S: transaction.type },
      provider: { S: transaction.provider },
      providerName: { S: transaction.providerName || transaction.provider },
      price: { N: transaction.price.toString() },
      paymentHash: { S: transaction.paymentHash || '' },
      mediaUrl: { S: transaction.mediaUrl },
      createdAt: { S: transaction.createdAt || new Date().toISOString() }
    }
  });

  await dynamoClient.send(command);
}

/**
 * Obtiene una transacción por ID
 */
async function getTransaction(transactionId) {
  // Mock storage si AWS no está configurado
  if (!isAWSConfigured || !dynamoClient) {
    return mockTransactions.get(transactionId) || null;
  }

  const command = new GetItemCommand({
    TableName: config.aws.dynamoTable,
    Key: {
      transactionId: { S: transactionId }
    }
  });

  const response = await dynamoClient.send(command);

  if (!response.Item) {
    return null;
  }

  return {
    transactionId: response.Item.transactionId.S,
    prompt: response.Item.prompt.S,
    type: response.Item.type.S,
    provider: response.Item.provider.S,
    providerName: response.Item.providerName?.S || response.Item.provider.S,
    price: parseFloat(response.Item.price.N),
    paymentHash: response.Item.paymentHash?.S || '',
    mediaUrl: response.Item.mediaUrl.S,
    createdAt: response.Item.createdAt.S
  };
}

module.exports = {
  upload,
  saveTransaction,
  getTransaction
};
