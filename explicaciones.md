# Explicaciones Técnicas - UltraPayx402 Backend

Este documento explica en detalle cada archivo del proyecto, línea por línea.

---

## Tabla de Contenidos

1. [package.json - Configuración del Proyecto Node.js](#1-packagejson---configuración-del-proyecto-nodejs)
2. [src/config/index.js - Configuración Centralizada](#2-srcconfigindexjs---configuración-centralizada)
3. [src/index.js - Servidor Principal Express](#3-srcindexjs---servidor-principal-express)
4. [src/local.js - Servidor de Desarrollo](#4-srclocaljs---servidor-de-desarrollo)
5. [src/handlers/generate.js - Handler de Generación](#5-srchandlersgeneratejs---handler-de-generación)
6. [src/handlers/health.js - Health Check](#6-srchandlershealthjs---health-check)
7. [src/services/x402.js - Servicio de Micropagos](#7-srcservicesx402js---servicio-de-micropagos)
8. [src/services/ai.js - Servicio de Inteligencia Artificial](#8-srcservicesaijs---servicio-de-inteligencia-artificial)
9. [src/services/storage.js - Servicio de Almacenamiento](#9-srcservicesstoragejs---servicio-de-almacenamiento)
10. [terraform/main.tf - Infraestructura AWS](#10-terraformmaintf---infraestructura-aws)
11. [terraform/variables.tf - Variables de Terraform](#11-terraformvariablestf---variables-de-terraform)
12. [terraform/outputs.tf - Outputs de Terraform](#12-terraformoutputstf---outputs-de-terraform)

---

## 1. package.json - Configuración del Proyecto Node.js

```json
{
  "name": "ultrapay-backend",
  "version": "1.0.0",
  "description": "Backend for UltraPayx402 - Micropayments for AI image/video generation",
  "main": "src/index.js",
```

### Metadatos del Proyecto

| Campo | Propósito |
|-------|-----------|
| `name` | Identificador único del paquete. Se usa cuando publicas a npm o cuando otros proyectos importan el tuyo. Debe ser lowercase, sin espacios. |
| `version` | Versión semántica (MAJOR.MINOR.PATCH). 1.0.0 significa primera versión estable. |
| `description` | Descripción legible que aparece en npm y herramientas de búsqueda. |
| `main` | **Punto de entrada del módulo**. Cuando otro archivo hace `require('ultrapay-backend')`, Node.js carga este archivo. |

```json
  "scripts": {
    "dev": "node src/local.js",
    "test": "jest",
    "deploy": "npm run build && aws lambda update-function-code --function-name ultrapay-api --zip-file fileb://dist.zip"
  },
```

### Scripts de NPM

Los scripts son comandos que ejecutas con `npm run <nombre>`.

| Script | Comando Real | Cuándo Usarlo |
|--------|--------------|---------------|
| `dev` | `node src/local.js` | Desarrollo local. Inicia un servidor Express en tu máquina. |
| `test` | `jest` | Ejecuta tests unitarios con el framework Jest. |
| `deploy` | `npm run build && aws lambda...` | Producción. Compila el código y lo sube a AWS Lambda. |

**¿Por qué `node src/local.js` y no `node src/index.js`?**
- `index.js` exporta un handler para Lambda (serverless)
- `local.js` crea un servidor HTTP tradicional para desarrollo
- Son dos formas de ejecutar el mismo código

```json
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.0.0",
    "express": "^4.18.2",
    "serverless-http": "^3.2.0",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0"
  },
```

### Dependencias de Producción

Estas librerías se instalan en producción y desarrollo.

| Dependencia | Versión | Propósito Detallado |
|-------------|---------|---------------------|
| `@aws-sdk/client-dynamodb` | ^3.0.0 | **Cliente oficial de AWS para DynamoDB**. Es la versión 3 del SDK (modular). Solo importas lo que necesitas, reduciendo el tamaño del bundle. Permite operaciones CRUD en la base de datos NoSQL. |
| `@aws-sdk/client-s3` | ^3.0.0 | **Cliente oficial de AWS para S3**. Permite subir, descargar y gestionar archivos en buckets S3. |
| `@aws-sdk/s3-request-presigner` | ^3.0.0 | **Generador de URLs presignadas**. Crea URLs temporales que permiten acceso a objetos privados de S3 sin necesidad de credenciales. |
| `express` | ^4.18.2 | **Framework web minimalista**. Maneja routing, middleware, requests y responses HTTP. Es el estándar de facto para APIs en Node.js. |
| `serverless-http` | ^3.2.0 | **Adaptador Express → Lambda**. Convierte una app Express en un handler compatible con AWS Lambda. Permite usar el mismo código localmente y en la nube. |
| `dotenv` | ^16.3.1 | **Carga variables de entorno**. Lee el archivo `.env` y las inyecta en `process.env`. Nunca commits `.env` a git (contiene secretos). |
| `uuid` | ^9.0.0 | **Generador de identificadores únicos**. Crea UUIDs v4 (random) como `550e8400-e29b-41d4-a716-446655440000`. Prácticamente imposible de colisionar. |

**¿Qué significa `^3.0.0`?**
- El `^` (caret) permite actualizaciones menores y patches automáticas
- `^3.0.0` acepta `3.0.1`, `3.1.0`, `3.9.9`, pero NO `4.0.0`
- Esto sigue el versionado semántico (semver)

```json
  "devDependencies": {
    "jest": "^29.7.0"
  },
```

### Dependencias de Desarrollo

Solo se instalan en desarrollo, no van a producción.

| Dependencia | Propósito |
|-------------|-----------|
| `jest` | Framework de testing. Ejecuta tests, mocks, assertions. Creado por Facebook. |

```json
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Requisitos de Engine

| Campo | Propósito |
|-------|-----------|
| `engines.node` | Especifica la versión mínima de Node.js requerida. `>=18.0.0` significa Node 18 o superior. Lambda usa Node 18.x, así que garantizamos compatibilidad. |

---

## 2. src/config/index.js - Configuración Centralizada

```javascript
require('dotenv').config();
```

### Carga de Variables de Entorno

**¿Qué hace `require('dotenv').config()`?**

1. Busca un archivo llamado `.env` en la raíz del proyecto
2. Lee cada línea en formato `CLAVE=valor`
3. Inyecta cada par en `process.env`

**Ejemplo de `.env`:**
```
AWS_REGION=us-east-1
S3_BUCKET=mi-bucket-secreto
API_KEY=sk-123456789
```

**Después de `dotenv.config()`:**
```javascript
process.env.AWS_REGION    // "us-east-1"
process.env.S3_BUCKET     // "mi-bucket-secreto"
process.env.API_KEY       // "sk-123456789"
```

**¿Por qué usar variables de entorno?**
- **Seguridad**: Los secretos no van en el código
- **Flexibilidad**: Diferente configuración por ambiente (dev, staging, prod)
- **12-Factor App**: Buena práctica de desarrollo moderno

```javascript
module.exports = {
```

### Patrón de Exportación CommonJS

`module.exports` es la forma de Node.js (CommonJS) de exportar valores para que otros archivos puedan importarlos.

```javascript
// En config/index.js
module.exports = { foo: 'bar' };

// En otro archivo
const config = require('./config');
console.log(config.foo); // 'bar'
```

```javascript
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET || 'ultrapay-media',
    dynamoTable: process.env.DYNAMO_TABLE || 'ultrapay-transactions'
  },
```

### Configuración de AWS

| Propiedad | Variable de Entorno | Default | Propósito |
|-----------|--------------------|---------|-----------|
| `region` | `AWS_REGION` | `us-east-1` | **Región de AWS**. Los servicios de AWS están distribuidos geográficamente. `us-east-1` es Virginia del Norte, la región más antigua y con más servicios. |
| `s3Bucket` | `S3_BUCKET` | `ultrapay-media` | **Nombre del bucket S3**. Los nombres de bucket son globalmente únicos en todo AWS. |
| `dynamoTable` | `DYNAMO_TABLE` | `ultrapay-transactions` | **Nombre de la tabla DynamoDB**. Donde guardamos el historial de transacciones. |

**¿Qué es `process.env.X || 'default'`?**

Es el operador OR lógico usado como fallback:
```javascript
// Si process.env.AWS_REGION existe y no es falsy, úsalo
// Si no existe o es undefined/null/'', usa 'us-east-1'
const region = process.env.AWS_REGION || 'us-east-1';
```

```javascript
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.ultravioletadao.xyz/',
    walletAddress: process.env.X402_WALLET_ADDRESS || '0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8'
  },
```

### Configuración de x402

| Propiedad | Propósito |
|-----------|-----------|
| `facilitatorUrl` | **URL del servicio facilitador x402**. Este servicio actúa como intermediario para verificar pagos. Es un servicio externo que valida que el pago en blockchain realmente ocurrió. |
| `walletAddress` | **Dirección de tu wallet EVM**. Aquí es donde recibes los pagos. Es una dirección Ethereum/compatible (empieza con `0x`, 40 caracteres hex). Esta es la wallet del TESTNET. |

**¿Qué es x402?**

HTTP 402 es un código de estado reservado para "Payment Required". El protocolo x402 usa este código para implementar micropagos nativos en HTTP:

1. Cliente hace request sin pago
2. Servidor responde 402 con información de pago
3. Cliente paga (cripto)
4. Cliente reenvía request con prueba de pago
5. Servidor verifica y procesa

```javascript
  pricing: {
    imagePrompt: 0.05,  // USD per image prompt
    videoPrompt: 0.25   // USD per video prompt
  },
```

### Configuración de Precios

| Propiedad | Valor | Propósito |
|-----------|-------|-----------|
| `imagePrompt` | `0.05` | **Precio por generar una imagen**. $0.05 USD por prompt. |
| `videoPrompt` | `0.25` | **Precio por generar un video**. $0.25 USD por prompt. Los videos son más costosos porque requieren más computación. |

**¿Por qué estos precios?**
- Micropagos deben ser lo suficientemente pequeños para no requerir suscripción
- Lo suficientemente grandes para cubrir costos de APIs de IA
- Competitivos vs suscripciones mensuales (~$20-30/mes)

```javascript
  ai: {
    providers: ['nanobanana', 'veo3', 'sd35', 'runway', 'midjourney']
  }
};
```

### Configuración de Proveedores de IA

| Proveedor | Tipo | Descripción |
|-----------|------|-------------|
| `nanobanana` | Imágenes | Servicio de generación de imágenes |
| `veo3` | Videos/Imágenes | Google Veo 3, modelo de generación de video |
| `sd35` | Imágenes | Stable Diffusion 3.5, modelo open-source |
| `runway` | Videos | Runway Gen-3, especializado en video |
| `midjourney` | Imágenes | Midjourney, conocido por calidad artística |

**¿Por qué un array?**
- Permite iterar sobre los proveedores
- Fácil agregar/remover proveedores
- El frontend puede mostrar la lista dinámicamente

---

## 3. src/index.js - Servidor Principal Express

```javascript
const express = require('express');
const serverless = require('serverless-http');
const { generateHandler } = require('./handlers/generate');
const { healthHandler } = require('./handlers/health');
const aiService = require('./services/ai');
```

### Imports

| Import | Tipo | Propósito |
|--------|------|-----------|
| `express` | Librería externa | Framework web. Crea la aplicación HTTP. |
| `serverless` | Librería externa | Wrapper que convierte Express a formato Lambda. |
| `{ generateHandler }` | Módulo local | **Destructuring import**. Extrae solo la función `generateHandler` del módulo. Equivale a `const generateHandler = require('./handlers/generate').generateHandler;` |
| `{ healthHandler }` | Módulo local | Handler para el endpoint de health check. |
| `aiService` | Módulo local | **Import completo del módulo**. Importa el objeto entero porque usamos múltiples funciones. |

**¿Cuándo usar destructuring vs import completo?**
```javascript
// Destructuring: cuando solo necesitas una o pocas funciones específicas
const { generateHandler } = require('./handlers/generate');

// Import completo: cuando necesitas múltiples funciones o el módulo entero
const aiService = require('./services/ai');
aiService.generate();
aiService.getAvailableProviders();
```

```javascript
const app = express();
```

### Creación de la Aplicación Express

`express()` es una función factory que retorna una instancia de aplicación Express.

Esta instancia (`app`) es el núcleo de tu servidor:
- Registra rutas (GET, POST, etc.)
- Registra middleware
- Maneja el ciclo request/response

```javascript
// Middleware
app.use(express.json());
```

### Middleware de Parsing JSON

**¿Qué es un Middleware?**

Un middleware es una función que se ejecuta ENTRE que llega el request y que se envía el response:

```
Request → [Middleware 1] → [Middleware 2] → [Route Handler] → Response
```

**¿Qué hace `express.json()`?**

1. Intercepta requests con `Content-Type: application/json`
2. Lee el body del request (que viene como string)
3. Parsea el JSON a objeto JavaScript
4. Lo asigna a `req.body`

**Sin este middleware:**
```javascript
app.post('/api', (req, res) => {
  console.log(req.body); // undefined
});
```

**Con este middleware:**
```javascript
app.post('/api', (req, res) => {
  console.log(req.body); // { prompt: "un gato", type: "image" }
});
```

```javascript
// CORS para frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment, x402-payment');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

### Middleware de CORS (Cross-Origin Resource Sharing)

**¿Qué problema resuelve CORS?**

Por seguridad, los navegadores bloquean requests JavaScript a dominios diferentes:

```
Frontend: https://ultrapay-frontend.com
Backend:  https://api.ultrapay.com

El navegador BLOQUEA el request porque son dominios diferentes.
```

CORS es un protocolo que permite al servidor indicar qué orígenes tienen permiso.

**Desglose de los headers:**

| Header | Valor | Propósito |
|--------|-------|-----------|
| `Access-Control-Allow-Origin` | `*` | **Orígenes permitidos**. `*` significa "cualquier origen". En producción, especificarías tu dominio exacto: `https://ultrapay.com` |
| `Access-Control-Allow-Headers` | `Content-Type, X-Payment, x402-payment` | **Headers personalizados permitidos**. El navegador bloquea headers custom por defecto. Necesitamos permitir los headers de x402. |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` | **Métodos HTTP permitidos**. |

**¿Qué es el request OPTIONS?**

Antes de ciertos requests (POST con JSON, headers custom), el navegador envía un "preflight request" con método OPTIONS para preguntar si tiene permiso. Si respondemos 200, procede con el request real.

```javascript
if (req.method === 'OPTIONS') {
  return res.sendStatus(200);  // Responde OK al preflight
}
next();  // Si no es OPTIONS, continúa al siguiente middleware/handler
```

**¿Qué es `next()`?**

`next()` es una función que le dice a Express: "terminé con este middleware, pasa al siguiente". Si no llamas `next()`, el request se queda colgado.

```javascript
// Routes
app.get('/health', healthHandler);
app.post('/generate', generateHandler);
```

### Definición de Rutas

| Método | Ruta | Handler | Propósito |
|--------|------|---------|-----------|
| `GET` | `/health` | `healthHandler` | **Health check**. Endpoint simple que responde OK. Usado por balanceadores de carga, monitoreo, etc. |
| `POST` | `/generate` | `generateHandler` | **Endpoint principal**. Recibe prompt, verifica pago, genera contenido. |

**¿Por qué GET vs POST?**
- `GET`: Obtener datos, sin body, idempotente (mismo request = mismo resultado)
- `POST`: Enviar datos, tiene body, no idempotente (cada request puede crear algo nuevo)

```javascript
// Endpoint para listar proveedores disponibles
app.get('/providers', (req, res) => {
  res.json({
    providers: aiService.getAvailableProviders()
  });
});
```

### Endpoint de Proveedores (Inline Handler)

En vez de crear un archivo separado, definimos el handler directamente (inline). Útil para endpoints simples.

**`res.json()`** hace dos cosas:
1. Serializa el objeto a JSON string
2. Establece el header `Content-Type: application/json`

```javascript
// Endpoint para obtener precios
app.get('/pricing', (req, res) => {
  const config = require('./config');
  res.json({
    image: config.pricing.imagePrompt,
    video: config.pricing.videoPrompt,
    currency: 'USD'
  });
});
```

### Endpoint de Precios

**¿Por qué `require('./config')` dentro de la función?**

Técnicamente podrías importarlo arriba. Aquí está inline para mostrar que puedes importar dinámicamente. En este caso no hay diferencia práctica porque Node.js cachea los requires.

```javascript
// Export para Lambda
module.exports.handler = serverless(app);
```

### Export para AWS Lambda

**¿Qué hace `serverless(app)`?**

AWS Lambda espera un handler con esta firma:
```javascript
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello' })
  };
};
```

Pero nosotros tenemos una app Express. `serverless-http` actúa como traductor:

```
Lambda Event → serverless-http → Express Request
                                        ↓
                                  Tu app procesa
                                        ↓
Lambda Response ← serverless-http ← Express Response
```

```javascript
// Export app para desarrollo local
module.exports.app = app;
```

### Export para Desarrollo Local

Exportamos también `app` directamente para poder usarla en `local.js` sin el wrapper de Lambda.

---

## 4. src/local.js - Servidor de Desarrollo

```javascript
/**
 * Servidor local para desarrollo
 * Ejecutar con: npm run dev
 */
const { app } = require('./index');
```

### Import de la Aplicación Express

Usamos destructuring para extraer solo `app` del módulo index (que exporta `{ handler, app }`).

```javascript
const PORT = process.env.PORT || 3000;
```

### Configuración del Puerto

| Variable | Propósito |
|----------|-----------|
| `process.env.PORT` | Muchos servicios de hosting (Heroku, Railway) inyectan el puerto vía variable de entorno |
| `3000` | Puerto por defecto para desarrollo local |

**¿Por qué no hardcodear el puerto?**
- Flexibilidad: diferentes ambientes pueden necesitar diferentes puertos
- Compatibilidad: servicios cloud asignan puertos dinámicamente

```javascript
app.listen(PORT, () => {
  console.log(`UltraPay Backend running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health    - Health check');
  console.log('  GET  /providers - List AI providers');
  console.log('  GET  /pricing   - Get pricing info');
  console.log('  POST /generate  - Generate image/video (requires x402 payment)');
});
```

### Inicio del Servidor HTTP

**`app.listen(port, callback)`:**
1. Crea un servidor HTTP
2. Lo vincula al puerto especificado
3. Comienza a escuchar conexiones
4. Ejecuta el callback cuando está listo

El callback es útil para:
- Confirmar que el servidor inició correctamente
- Mostrar información útil (URL, endpoints disponibles)

---

## 5. src/handlers/generate.js - Handler de Generación

```javascript
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const x402Service = require('../services/x402');
const aiService = require('../services/ai');
const storageService = require('../services/storage');
```

### Imports con Alias

**`{ v4: uuidv4 }`** es destructuring con renombre:
- Extrae la propiedad `v4` del módulo `uuid`
- La renombra a `uuidv4` para mayor claridad

**¿Por qué UUID v4?**
- v1: Basado en timestamp + MAC address (puede exponer información)
- v4: Completamente random (122 bits de entropía)
- v4 es el más usado para IDs de aplicación

```javascript
/**
 * Handler para generación de imágenes/videos con micropago x402
 */
async function generateHandler(req, res) {
```

### Función Async

**¿Por qué `async`?**

Esta función realiza operaciones asíncronas:
- Verificar pago (podría hacer request HTTP)
- Generar con IA (request a API externa)
- Subir a S3 (request a AWS)
- Guardar en DynamoDB (request a AWS)

`async` permite usar `await` dentro de la función para manejar Promises de forma limpia.

```javascript
  try {
    const { prompt, type, provider } = req.body;
```

### Destructuring del Body

Extrae los campos del JSON que envió el cliente:
```json
{
  "prompt": "un gato astronauta",
  "type": "image",
  "provider": "midjourney"
}
```

Se convierte en tres variables: `prompt`, `type`, `provider`.

```javascript
    // Validaciones
    if (!prompt || !type) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, type'
      });
    }
```

### Validación de Campos Requeridos

**HTTP 400 Bad Request**: El cliente envió datos inválidos o incompletos.

**¿Por qué validar?**
1. **Seguridad**: Prevenir datos maliciosos
2. **Estabilidad**: Evitar crashes por undefined
3. **UX**: Dar feedback claro al cliente

**`!prompt`** es falsy si:
- `undefined` (no se envió)
- `null`
- `''` (string vacío)
- `0` (pero esto no aplica a prompts)

```javascript
    if (!['image', 'video'].includes(type)) {
      return res.status(400).json({
        error: 'Type must be "image" or "video"'
      });
    }
```

### Validación de Tipo

**`Array.includes(value)`** verifica si el valor existe en el array.

Solo permitimos `'image'` o `'video'`. Cualquier otro valor es rechazado.

```javascript
    const price = type === 'image' ? config.pricing.imagePrompt : config.pricing.videoPrompt;
    const transactionId = uuidv4();
```

### Cálculo de Precio y Generación de ID

**Operador ternario**: `condición ? valorSiTrue : valorSiFalse`

```javascript
const price = type === 'image' ? 0.05 : 0.25;
// Si es imagen: $0.05
// Si es video: $0.25
```

**`uuidv4()`** genera algo como: `'550e8400-e29b-41d4-a716-446655440000'`

```javascript
    // Verificar pago x402
    const paymentValid = await x402Service.verifyPayment(req, price);
    if (!paymentValid.success) {
      return res.status(402).json({
        error: 'Payment required',
        price: price,
        currency: 'USD',
        x402: paymentValid.x402Headers
      });
    }
```

### Verificación de Pago x402

**HTTP 402 Payment Required**: Código específico para indicar que se requiere pago.

**Flujo:**
1. `verifyPayment` busca el header `X-Payment` en el request
2. Si no existe o es inválido, retorna `{ success: false, x402Headers: {...} }`
3. Respondemos 402 con la información necesaria para que el cliente pague
4. Si es válido, retorna `{ success: true, paymentHash: '0x...' }`

```javascript
    // Generar contenido con IA
    const selectedProvider = provider || config.ai.providers[0];
    const result = await aiService.generate({
      prompt,
      type,
      provider: selectedProvider
    });
```

### Generación con IA

**`provider || config.ai.providers[0]`**: Si el cliente no especificó proveedor, usamos el primero de la lista (nanobanana).

**`await aiService.generate({...})`**: Espera a que la IA genere el contenido. Esto puede tardar segundos.

```javascript
    // Subir a S3 y obtener URL
    const mediaUrl = await storageService.upload({
      data: result.data,
      type,
      transactionId
    });
```

### Subida a S3

El contenido generado (bytes de imagen/video) se sube a S3. Retorna una URL presignada para descargar.

```javascript
    // Registrar transacción
    await storageService.saveTransaction({
      transactionId,
      prompt,
      type,
      provider: selectedProvider,
      price,
      paymentHash: paymentValid.paymentHash,
      mediaUrl,
      createdAt: new Date().toISOString()
    });
```

### Registro de Transacción

Guardamos todo en DynamoDB para:
- **Auditoría**: Saber qué se generó y cuándo
- **Historial**: El usuario puede ver sus generaciones pasadas
- **Debugging**: Investigar problemas
- **Analytics**: Entender patrones de uso

**`new Date().toISOString()`** genera: `'2025-12-01T15:30:00.000Z'`

```javascript
    return res.status(200).json({
      success: true,
      transactionId,
      mediaUrl,
      type,
      provider: selectedProvider
    });
```

### Respuesta Exitosa

**HTTP 200 OK**: Todo salió bien.

El cliente recibe:
```json
{
  "success": true,
  "transactionId": "550e8400-...",
  "mediaUrl": "https://s3.amazonaws.com/...",
  "type": "image",
  "provider": "midjourney"
}
```

```javascript
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
```

### Manejo de Errores

**HTTP 500 Internal Server Error**: Algo falló en el servidor.

**¿Por qué try/catch?**
- Las operaciones `await` pueden fallar (red, API caída, etc.)
- Sin try/catch, el error crashearía el proceso
- Con try/catch, capturamos el error y respondemos apropiadamente

**`console.error`** loguea para debugging pero no expone detalles sensibles al cliente.

---

## 6. src/handlers/health.js - Health Check

```javascript
/**
 * Health check endpoint
 */
async function healthHandler(req, res) {
  return res.status(200).json({
    status: 'ok',
    service: 'ultrapay-backend',
    timestamp: new Date().toISOString()
  });
}

module.exports = { healthHandler };
```

### Propósito del Health Check

| Campo | Propósito |
|-------|-----------|
| `status` | Indica que el servicio está funcionando |
| `service` | Identifica qué servicio respondió (útil en arquitecturas con múltiples servicios) |
| `timestamp` | Confirma que la respuesta es fresca, no cacheada |

**¿Quién usa este endpoint?**
- **Load Balancers**: Verifican si la instancia está sana antes de enviarle tráfico
- **Kubernetes**: Liveness/Readiness probes
- **Monitoreo**: Alertas cuando el servicio no responde
- **Desarrolladores**: Verificación rápida de que el deploy funcionó

---

## 7. src/services/x402.js - Servicio de Micropagos

```javascript
const config = require('../config');

/**
 * Servicio para integración con x402 micropayments
 * Docs: https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers
 */
```

### Documentación en Código

Los comentarios JSDoc (`/** */`) son especiales:
- IDEs los muestran como tooltips
- Herramientas pueden generar documentación automática
- Ayudan a entender el propósito sin leer el código

```javascript
/**
 * Verifica el pago x402 en el request
 * @param {Object} req - Express request
 * @param {number} price - Precio en USD
 * @returns {Object} - { success, paymentHash, x402Headers }
 */
async function verifyPayment(req, price) {
  const paymentHeader = req.headers['x-payment'] || req.headers['x402-payment'];
```

### Extracción del Header de Pago

**`req.headers`** es un objeto con todos los headers HTTP:
```javascript
{
  'content-type': 'application/json',
  'x-payment': '0x123abc...',
  'user-agent': 'Mozilla/5.0...'
}
```

**Nota**: Los nombres de headers se normalizan a lowercase en Express.

Buscamos dos posibles nombres porque el protocolo x402 puede usar cualquiera.

```javascript
  if (!paymentHeader) {
    return {
      success: false,
      x402Headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Amount': price.toString(),
        'X-Payment-Currency': 'USD',
        'X-Payment-Recipient': config.x402.walletAddress,
        'X-Facilitator-URL': config.x402.facilitatorUrl
      }
    };
  }
```

### Respuesta 402 con Información de Pago

Cuando no hay header de pago, retornamos los datos necesarios para que el cliente pueda pagar:

| Header | Propósito |
|--------|-----------|
| `X-Payment-Required` | Indica que se requiere pago |
| `X-Payment-Amount` | Cuánto pagar |
| `X-Payment-Currency` | En qué moneda |
| `X-Payment-Recipient` | A qué wallet enviar |
| `X-Facilitator-URL` | URL del servicio que procesa el pago |

```javascript
  try {
    // TODO: Implementar verificación real con facilitador x402
    const isValid = await verifyWithFacilitator(paymentHeader, price);

    if (isValid) {
      return {
        success: true,
        paymentHash: extractPaymentHash(paymentHeader)
      };
    }

    return {
      success: false,
      x402Headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Invalid': 'true'
      }
    };

  } catch (error) {
    console.error('x402 verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Verificación del Pago

**Flujo de verificación:**
1. Hay un header de pago → intentamos verificarlo
2. Llamamos al facilitador para confirmar que el pago es real
3. Si es válido → `{ success: true, paymentHash }`
4. Si es inválido → `{ success: false, x402Headers con X-Payment-Invalid }`
5. Si hay error → `{ success: false, error }`

```javascript
/**
 * Verifica el pago con el facilitador x402
 */
async function verifyWithFacilitator(paymentHeader, expectedAmount) {
  // TODO: Implementar llamada real al facilitador
  // const response = await fetch(config.x402.facilitatorUrl + '/verify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ payment: paymentHeader, amount: expectedAmount })
  // });
  // return response.ok;

  // Simulación para desarrollo
  return paymentHeader && paymentHeader.length > 0;
}
```

### Placeholder de Verificación

El código comentado muestra cómo sería la implementación real:
1. Hacer POST al facilitador con el token de pago
2. El facilitador verifica en blockchain que el pago ocurrió
3. Retorna si es válido o no

Por ahora, simulamos: si hay cualquier header, lo consideramos válido (solo para desarrollo).

```javascript
/**
 * Extrae el hash de pago del header
 */
function extractPaymentHash(paymentHeader) {
  // TODO: Parsear el header real de x402
  return paymentHeader.substring(0, 66) || 'simulated-hash';
}
```

### Extracción del Hash

El hash de pago es el identificador de la transacción en blockchain.
- Los hashes de Ethereum tienen 66 caracteres (0x + 64 hex)
- Lo guardamos para auditoría y posibles disputas

```javascript
/**
 * Genera headers de respuesta 402 para solicitar pago
 */
function generatePaymentRequired(price, description) {
  return {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Amount': price.toString(),
      'X-Payment-Currency': 'USD',
      'X-Payment-Recipient': config.x402.walletAddress,
      'X-Payment-Description': description,
      'X-Facilitator-URL': config.x402.facilitatorUrl
    }
  };
}

module.exports = {
  verifyPayment,
  generatePaymentRequired
};
```

### Helper para Generar Respuesta 402

Función de utilidad que genera el objeto de respuesta 402 completo. Útil si múltiples endpoints necesitan solicitar pago.

---

## 8. src/services/ai.js - Servicio de Inteligencia Artificial

```javascript
const config = require('../config');

/**
 * Servicio para integración con proveedores de IA
 * Soporta: Veo 3, NanoBanana, SD 3.5, Runway Gen-3, Midjourney
 */

/**
 * Genera contenido usando el proveedor de IA especificado
 * @param {Object} params - { prompt, type, provider }
 * @returns {Object} - { data, metadata }
 */
async function generate({ prompt, type, provider }) {
  const generators = {
    nanobanana: generateWithNanoBanana,
    veo3: generateWithVeo3,
    sd35: generateWithSD35,
    runway: generateWithRunway,
    midjourney: generateWithMidjourney
  };

  const generator = generators[provider];
  if (!generator) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return generator(prompt, type);
}
```

### Patrón Strategy (Estrategia)

Este es un patrón de diseño clásico que permite seleccionar un algoritmo en runtime.

**¿Cómo funciona?**

```javascript
// El objeto 'generators' mapea nombres a funciones
const generators = {
  nanobanana: generateWithNanoBanana,  // La función, no su resultado
  veo3: generateWithVeo3,
  // ...
};

// Seleccionamos la función según el provider
const generator = generators['midjourney'];
// generator ahora ES la función generateWithMidjourney

// La ejecutamos
return generator(prompt, type);
// Equivale a: return generateWithMidjourney(prompt, type);
```

**¿Por qué este patrón vs if/else?**

```javascript
// ❌ Con if/else (difícil de mantener)
if (provider === 'nanobanana') {
  return generateWithNanoBanana(prompt, type);
} else if (provider === 'veo3') {
  return generateWithVeo3(prompt, type);
} else if (provider === 'sd35') {
  return generateWithSD35(prompt, type);
}
// ... muchos más ifs

// ✅ Con Strategy (limpio y extensible)
const generators = { nanobanana, veo3, sd35, runway, midjourney };
return generators[provider](prompt, type);
```

**Beneficios:**
- Agregar nuevo proveedor = agregar una línea
- Código más legible
- Fácil de testear cada estrategia por separado

```javascript
/**
 * NanoBanana - Generación de imágenes
 */
async function generateWithNanoBanana(prompt, type) {
  // TODO: Implementar integración real con NanoBanana API
  console.log(`[NanoBanana] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'nanobanana',
      model: 'nanobanana-v1',
      prompt
    }
  };
}
```

### Función de Generación (Placeholder)

**Estructura de retorno:**

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `data` | `Buffer` | Los bytes raw de la imagen/video generada |
| `metadata.provider` | `string` | Qué servicio generó el contenido |
| `metadata.model` | `string` | Qué modelo específico se usó |
| `metadata.prompt` | `string` | El prompt original (para auditoría) |

**¿Qué es `Buffer`?**

`Buffer` es la forma de Node.js de manejar datos binarios (bytes). Una imagen PNG no es texto, son bytes, así que usamos Buffer.

```javascript
// Buffer de ejemplo (placeholder)
Buffer.from('placeholder')  // Bytes del string 'placeholder'

// En implementación real sería algo como:
Buffer.from(responseFromAI, 'base64')  // Decodificar base64 de la API
```

**Implementación real (ejemplo conceptual):**
```javascript
async function generateWithNanoBanana(prompt, type) {
  const response = await fetch('https://api.nanobanana.com/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NANOBANANA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, type })
  });

  const result = await response.json();
  const imageBuffer = Buffer.from(result.image, 'base64');

  return {
    data: imageBuffer,
    metadata: { provider: 'nanobanana', model: result.model, prompt }
  };
}
```

```javascript
/**
 * Lista de proveedores disponibles
 */
function getAvailableProviders() {
  return config.ai.providers.map(p => ({
    id: p,
    types: getProviderTypes(p)
  }));
}

function getProviderTypes(provider) {
  const videoProviders = ['veo3', 'runway'];
  const imageProviders = ['nanobanana', 'sd35', 'midjourney'];

  if (videoProviders.includes(provider)) return ['video', 'image'];
  if (imageProviders.includes(provider)) return ['image'];
  return ['image'];
}
```

### Listado de Proveedores

**`Array.map()`** transforma cada elemento:

```javascript
['nanobanana', 'veo3'].map(p => ({ id: p, types: getProviderTypes(p) }))
// Resultado:
[
  { id: 'nanobanana', types: ['image'] },
  { id: 'veo3', types: ['video', 'image'] }
]
```

Esto permite al frontend saber:
- Qué proveedores existen
- Qué puede generar cada uno

---

## 9. src/services/storage.js - Servicio de Almacenamiento

```javascript
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const config = require('../config');
```

### AWS SDK v3 - Arquitectura Modular

**¿Por qué tantos imports?**

AWS SDK v3 es modular. Solo importas lo que necesitas:
- `S3Client`: Cliente base para S3
- `PutObjectCommand`: Comando para subir objetos
- `GetObjectCommand`: Comando para obtener objetos
- `getSignedUrl`: Utilidad para URLs presignadas
- `DynamoDBClient`: Cliente base para DynamoDB
- `PutItemCommand`: Comando para insertar items
- `GetItemCommand`: Comando para obtener items

**Beneficios:**
- Bundle más pequeño (no incluyes código que no usas)
- Tree-shaking efectivo
- Mejor para Lambda (menor cold start)

```javascript
const s3Client = new S3Client({ region: config.aws.region });
const dynamoClient = new DynamoDBClient({ region: config.aws.region });
```

### Inicialización de Clientes

Los clientes se crean una vez y se reutilizan. Esto es importante porque:
- Crear cliente es costoso (establece conexiones)
- Reutilizar es eficiente (connection pooling)

**¿Por qué solo `region`?**

En Lambda, las credenciales de AWS se inyectan automáticamente vía IAM Role. No necesitas `accessKeyId` ni `secretAccessKey`.

```javascript
/**
 * Sube contenido generado a S3
 * @param {Object} params - { data, type, transactionId }
 * @returns {string} - URL presignada del contenido
 */
async function upload({ data, type, transactionId }) {
  const extension = type === 'video' ? 'mp4' : 'png';
  const contentType = type === 'video' ? 'video/mp4' : 'image/png';
  const key = `generated/${transactionId}.${extension}`;
```

### Preparación para Subida

| Variable | Ejemplo | Propósito |
|----------|---------|-----------|
| `extension` | `'png'` o `'mp4'` | Extensión del archivo |
| `contentType` | `'image/png'` | MIME type para headers HTTP |
| `key` | `'generated/abc123.png'` | "Ruta" del archivo en S3 (S3 no tiene carpetas reales, solo prefijos) |

```javascript
  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: data,
    ContentType: contentType
  });

  await s3Client.send(command);
```

### Subida a S3

**Patrón Command en AWS SDK v3:**

1. Creas un comando con los parámetros
2. Envías el comando al cliente
3. El cliente ejecuta la operación

```javascript
// Parámetros de PutObjectCommand:
{
  Bucket: 'ultrapay-media',        // Nombre del bucket
  Key: 'generated/abc123.png',     // "Path" del objeto
  Body: <Buffer ...>,              // Los bytes a subir
  ContentType: 'image/png'         // MIME type
}
```

```javascript
  // Generar URL presignada (válida por 1 hora)
  const getCommand = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key
  });

  const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

  return presignedUrl;
}
```

### URLs Presignadas

**¿Qué problema resuelven?**

El bucket S3 es privado (no accesible públicamente). Pero necesitamos que el usuario pueda descargar su imagen.

**Solución: URL presignada**
- Es una URL normal de S3
- Incluye firma criptográfica en los query params
- Válida solo por tiempo limitado (3600 segundos = 1 hora)
- No requiere autenticación para usarla

**Ejemplo de URL presignada:**
```
https://ultrapay-media.s3.amazonaws.com/generated/abc123.png
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=...
  &X-Amz-Date=20251201T150000Z
  &X-Amz-Expires=3600
  &X-Amz-Signature=abc123...
```

```javascript
/**
 * Guarda la transacción en DynamoDB
 */
async function saveTransaction(transaction) {
  const command = new PutItemCommand({
    TableName: config.aws.dynamoTable,
    Item: {
      transactionId: { S: transaction.transactionId },
      prompt: { S: transaction.prompt },
      type: { S: transaction.type },
      provider: { S: transaction.provider },
      price: { N: transaction.price.toString() },
      paymentHash: { S: transaction.paymentHash },
      mediaUrl: { S: transaction.mediaUrl },
      createdAt: { S: transaction.createdAt }
    }
  });

  await dynamoClient.send(command);
}
```

### Guardar en DynamoDB

**¿Qué es `{ S: valor }` y `{ N: valor }`?**

DynamoDB usa un formato especial para los valores:
- `{ S: 'texto' }` → String
- `{ N: '123' }` → Number (siempre como string!)
- `{ B: buffer }` → Binary
- `{ BOOL: true }` → Boolean
- `{ L: [...] }` → List
- `{ M: {...} }` → Map

**¿Por qué este formato raro?**

DynamoDB es schemaless pero necesita saber el tipo de cada valor para indexación y operaciones.

```javascript
/**
 * Obtiene una transacción por ID
 */
async function getTransaction(transactionId) {
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
    price: parseFloat(response.Item.price.N),
    paymentHash: response.Item.paymentHash.S,
    mediaUrl: response.Item.mediaUrl.S,
    createdAt: response.Item.createdAt.S
  };
}
```

### Obtener de DynamoDB

**Flujo:**
1. Creamos comando GetItem con la clave primaria
2. Enviamos al cliente
3. Si no existe, `response.Item` es `undefined`
4. Si existe, convertimos del formato DynamoDB a objeto JavaScript normal

**`parseFloat(response.Item.price.N)`**: Convertimos el string a número.

---

## 10. terraform/main.tf - Infraestructura AWS

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}
```

### Bloque Terraform

| Campo | Propósito |
|-------|-----------|
| `required_providers` | Declara qué providers (plugins) necesita este código |
| `source` | De dónde descargar el provider (registry de HashiCorp) |
| `version` | Versión del provider. `~> 5.0` acepta 5.x pero no 6.0 |
| `required_version` | Versión mínima de Terraform CLI |

**¿Qué es un Provider?**

Un provider es un plugin que sabe cómo interactuar con una plataforma:
- `aws` → Amazon Web Services
- `google` → Google Cloud
- `azurerm` → Microsoft Azure
- `kubernetes` → Kubernetes

```hcl
provider "aws" {
  region = var.aws_region
}
```

### Configuración del Provider AWS

Configura el provider con la región donde crear recursos.

**¿De dónde salen las credenciales?**
Terraform busca en este orden:
1. Variables de entorno (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Archivo `~/.aws/credentials`
3. IAM Role (si corre en AWS)

```hcl
# S3 Bucket para almacenar imágenes/videos generados
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
```

### Recurso S3 Bucket

**Sintaxis de recursos:**
```hcl
resource "TIPO" "NOMBRE_LOCAL" {
  # Configuración
}
```

- `TIPO`: Tipo de recurso del provider (`aws_s3_bucket`)
- `NOMBRE_LOCAL`: Identificador para referenciar en Terraform (`media`)

**`"${var.project_name}-media-${var.environment}"`**: Interpolación de strings.
- Si `project_name = "ultrapay"` y `environment = "dev"`
- Resultado: `"ultrapay-media-dev"`

**Tags**: Metadatos para organización, billing, filtrado en consola AWS.

```hcl
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
```

### CORS de S3

El frontend necesita subir/descargar directamente de S3. Sin CORS, el navegador bloquea.

**`bucket = aws_s3_bucket.media.id`**: Referencia al bucket creado arriba. Terraform sabe que debe crear el bucket primero.

```hcl
# DynamoDB Table para transacciones
resource "aws_dynamodb_table" "transactions" {
  name           = "${var.project_name}-transactions-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "transactionId"

  attribute {
    name = "transactionId"
    type = "S"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
```

### Tabla DynamoDB

| Campo | Propósito |
|-------|-----------|
| `name` | Nombre de la tabla |
| `billing_mode` | `PAY_PER_REQUEST` = pago por operación (serverless). Alternativa: `PROVISIONED` = capacidad fija |
| `hash_key` | **Partition Key**. Campo por el cual se distribuyen y buscan los datos. |
| `attribute` | Define el tipo del atributo usado como key. `S` = String |

**¿Por qué `PAY_PER_REQUEST`?**
- No pagas si no hay tráfico
- Escala automáticamente
- Ideal para cargas variables o startups

```hcl
# IAM Role para Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}
```

### IAM Role

**¿Qué es un IAM Role?**

Es una identidad que puede ser "asumida" por servicios o usuarios. La Lambda necesita permisos para acceder a S3 y DynamoDB.

**`assume_role_policy`**: Define QUIÉN puede usar este rol.
- En este caso, el servicio Lambda (`lambda.amazonaws.com`)

**`jsonencode()`**: Función de Terraform que convierte HCL a JSON.

```hcl
# IAM Policy para Lambda (S3 + DynamoDB + CloudWatch)
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.transactions.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
```

### IAM Policy

**¿Qué es una Policy?**

Define QUÉ puede hacer el rol. Lista de permisos.

**Estructura de Statement:**

| Campo | Propósito |
|-------|-----------|
| `Effect` | `Allow` o `Deny` |
| `Action` | Operaciones permitidas (`s3:GetObject`) |
| `Resource` | A qué recursos aplica (ARN específico o wildcard) |

**¿Qué es un ARN?**

Amazon Resource Name. Identificador único global:
```
arn:aws:s3:::ultrapay-media-dev/*
     │   │   └── Nombre del bucket + path
     │   └── Servicio
     └── Partición (aws, aws-cn, aws-gov)
```

**Principio de Least Privilege**: Solo damos los permisos mínimos necesarios.

```hcl
# Lambda Function
resource "aws_lambda_function" "api" {
  filename         = var.lambda_zip_path
  function_name    = "${var.project_name}-api-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "src/index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      S3_BUCKET              = aws_s3_bucket.media.id
      DYNAMO_TABLE           = aws_dynamodb_table.transactions.id
      X402_FACILITATOR_URL   = var.x402_facilitator_url
      X402_WALLET_ADDRESS    = var.x402_wallet_address
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
```

### Lambda Function

| Campo | Propósito |
|-------|-----------|
| `filename` | Ruta al archivo ZIP con el código |
| `function_name` | Nombre de la función en AWS |
| `role` | ARN del IAM Role que usará |
| `handler` | Qué función ejecutar: `archivo.función` → `src/index.handler` |
| `runtime` | Ambiente de ejecución |
| `timeout` | Máximo segundos de ejecución (30s). Máximo permitido: 900s |
| `memory_size` | RAM en MB. Más RAM = más CPU proporcionalmente |
| `environment.variables` | Variables de entorno disponibles en `process.env` |

```hcl
# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "X-Payment", "x402-payment"]
  }
}
```

### API Gateway

**¿Qué es API Gateway?**

Servicio que expone tu Lambda a Internet. Maneja:
- Routing de URLs
- CORS
- Autenticación (opcional)
- Rate limiting (opcional)
- SSL/TLS

**`protocol_type = "HTTP"`**: API Gateway v2 (más barato y simple que REST API v1).

```hcl
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true
}
```

### Stage

Un stage es una versión desplegada de la API (dev, staging, prod).

**`auto_deploy = true`**: Despliega automáticamente cuando hay cambios.

```hcl
resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}
```

### Integration

Conecta API Gateway con Lambda.

**`AWS_PROXY`**: API Gateway pasa el request completo a Lambda y espera response en formato específico.

```hcl
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
```

### Route

Define qué paths van a qué integración.

**`$default`**: Ruta catch-all. Cualquier request que no matchee otra ruta va aquí.

Esto significa que Lambda maneja el routing internamente (Express).

```hcl
# Permission para API Gateway invocar Lambda
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
```

### Lambda Permission

Permite que API Gateway invoque la Lambda. Sin esto, API Gateway recibe "Access Denied".

---

## 11. terraform/variables.tf - Variables de Terraform

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "ultrapay"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "lambda_zip_path" {
  description = "Path to Lambda deployment package"
  type        = string
  default     = "../dist.zip"
}

variable "x402_facilitator_url" {
  description = "x402 Facilitator URL"
  type        = string
  default     = "https://facilitator.ultravioletadao.xyz/"
}

variable "x402_wallet_address" {
  description = "x402 Wallet address for receiving payments"
  type        = string
  default     = "0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8"
}
```

### Variables de Terraform

**Estructura de variable:**

| Campo | Propósito |
|-------|-----------|
| `description` | Documentación (aparece en `terraform plan`) |
| `type` | Tipo de dato (`string`, `number`, `bool`, `list`, `map`) |
| `default` | Valor por defecto si no se especifica |

**¿Cómo se sobreescriben?**

1. **Archivo `terraform.tfvars`:**
   ```hcl
   environment = "prod"
   aws_region  = "eu-west-1"
   ```

2. **Línea de comando:**
   ```bash
   terraform apply -var="environment=prod"
   ```

3. **Variables de entorno:**
   ```bash
   export TF_VAR_environment=prod
   ```

---

## 12. terraform/outputs.tf - Outputs de Terraform

```hcl
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.api.api_endpoint}/${aws_apigatewayv2_stage.api.name}"
}

output "s3_bucket" {
  description = "S3 bucket name for media storage"
  value       = aws_s3_bucket.media.id
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.transactions.id
}

output "lambda_function" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
```

### Outputs de Terraform

**¿Qué son los Outputs?**

Valores que Terraform muestra después de `terraform apply`:

```
Apply complete! Resources: 10 added, 0 changed, 0 destroyed.

Outputs:

api_endpoint = "https://abc123.execute-api.us-east-1.amazonaws.com/dev"
dynamodb_table = "ultrapay-transactions-dev"
lambda_function = "ultrapay-api-dev"
s3_bucket = "ultrapay-media-dev"
```

**¿Para qué sirven?**

1. **Información**: Saber la URL de tu API
2. **Integración**: Otros módulos/scripts pueden leer estos valores
3. **CI/CD**: Pipelines pueden extraer outputs para configuración

```bash
# Obtener un output específico
terraform output api_endpoint
# "https://abc123.execute-api.us-east-1.amazonaws.com/dev"
```

---

## Apéndice: Flujo Completo de una Petición

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO COMPLETO                                    │
│                                                                             │
│  1. Usuario en Frontend                                                     │
│     └─→ Click "Generar imagen de un gato"                                  │
│                                                                             │
│  2. Frontend (React)                                                        │
│     └─→ fetch('https://api.../generate', {                                 │
│           method: 'POST',                                                   │
│           body: JSON.stringify({ prompt: 'un gato', type: 'image' })       │
│         })                                                                  │
│                                                                             │
│  3. Internet → API Gateway                                                  │
│     └─→ Recibe HTTPS request                                               │
│     └─→ Valida, aplica CORS                                                │
│     └─→ Invoca Lambda                                                       │
│                                                                             │
│  4. Lambda (Cold Start si es primera invocación)                           │
│     └─→ Carga código Node.js                                               │
│     └─→ Ejecuta src/index.js                                               │
│                                                                             │
│  5. serverless-http                                                         │
│     └─→ Convierte Lambda event → Express request                           │
│                                                                             │
│  6. Express Middleware Chain                                                │
│     └─→ express.json() parsea body                                         │
│     └─→ CORS middleware agrega headers                                     │
│     └─→ Router matchea POST /generate                                      │
│                                                                             │
│  7. generateHandler                                                         │
│     └─→ Extrae { prompt, type } del body                                   │
│     └─→ Valida campos requeridos                                           │
│     └─→ Calcula precio ($0.05)                                             │
│     └─→ Llama x402Service.verifyPayment()                                  │
│                                                                             │
│  8. x402Service (Primera vez - sin pago)                                   │
│     └─→ No encuentra header X-Payment                                      │
│     └─→ Retorna { success: false, x402Headers: {...} }                     │
│                                                                             │
│  9. generateHandler                                                         │
│     └─→ Responde 402 Payment Required                                      │
│     └─→ { error: 'Payment required', price: 0.05, x402: {...} }           │
│                                                                             │
│  10. Frontend recibe 402                                                    │
│      └─→ Detecta que necesita pago                                         │
│      └─→ Abre wallet del usuario (Core Wallet)                             │
│      └─→ Usuario autoriza pago de $0.05                                    │
│      └─→ Blockchain procesa transacción                                    │
│      └─→ Recibe token de pago                                              │
│                                                                             │
│  11. Frontend reintenta con pago                                            │
│      └─→ fetch('https://api.../generate', {                                │
│            headers: { 'X-Payment': 'token...' },                           │
│            body: JSON.stringify({ prompt: 'un gato', type: 'image' })      │
│          })                                                                 │
│                                                                             │
│  12. Lambda (mismo flujo hasta x402Service)                                │
│                                                                             │
│  13. x402Service (con pago)                                                 │
│      └─→ Encuentra header X-Payment                                        │
│      └─→ Verifica con facilitador                                          │
│      └─→ Retorna { success: true, paymentHash: '0x...' }                   │
│                                                                             │
│  14. generateHandler continúa                                               │
│      └─→ Llama aiService.generate()                                        │
│                                                                             │
│  15. aiService                                                              │
│      └─→ Selecciona proveedor (midjourney)                                 │
│      └─→ Llama API externa de IA                                           │
│      └─→ Espera generación (~5-30 segundos)                                │
│      └─→ Retorna { data: Buffer, metadata: {...} }                         │
│                                                                             │
│  16. generateHandler continúa                                               │
│      └─→ Llama storageService.upload()                                     │
│                                                                             │
│  17. storageService.upload                                                  │
│      └─→ PutObject a S3                                                    │
│      └─→ Genera URL presignada                                             │
│      └─→ Retorna 'https://s3.../generated/abc.png?signature=...'           │
│                                                                             │
│  18. generateHandler continúa                                               │
│      └─→ Llama storageService.saveTransaction()                            │
│                                                                             │
│  19. storageService.saveTransaction                                         │
│      └─→ PutItem a DynamoDB                                                │
│      └─→ Guarda transacción completa                                       │
│                                                                             │
│  20. generateHandler finaliza                                               │
│      └─→ res.json({ success: true, mediaUrl: '...', ... })                │
│                                                                             │
│  21. serverless-http                                                        │
│      └─→ Convierte Express response → Lambda response                      │
│                                                                             │
│  22. Lambda → API Gateway → Internet → Frontend                            │
│                                                                             │
│  23. Frontend                                                               │
│      └─→ Recibe JSON con mediaUrl                                          │
│      └─→ Muestra imagen al usuario                                         │
│                                                                             │
│  24. Usuario                                                                │
│      └─→ Ve su imagen de un gato                                          │
│      └─→ Pagó $0.05                                                        │
│      └─→ Feliz :)                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Glosario de Términos

| Término | Definición |
|---------|------------|
| **API** | Application Programming Interface. Conjunto de endpoints HTTP que permiten interactuar con un servicio. |
| **ARN** | Amazon Resource Name. Identificador único para recursos en AWS. |
| **Buffer** | Objeto de Node.js para manejar datos binarios (bytes). |
| **Cold Start** | Primera invocación de Lambda donde se carga el código. Más lenta que invocaciones subsecuentes. |
| **CORS** | Cross-Origin Resource Sharing. Mecanismo de seguridad del navegador. |
| **Destructuring** | Sintaxis de JavaScript para extraer valores de objetos/arrays. |
| **DynamoDB** | Base de datos NoSQL serverless de AWS. |
| **Endpoint** | URL específica de una API que realiza una función. |
| **Express** | Framework web minimalista para Node.js. |
| **Handler** | Función que maneja un request HTTP. |
| **IAM** | Identity and Access Management. Sistema de permisos de AWS. |
| **Lambda** | Servicio serverless de AWS para ejecutar código. |
| **Middleware** | Función que procesa requests entre recepción y respuesta. |
| **Presigned URL** | URL temporal con firma criptográfica para acceso a recursos privados. |
| **Provider (Terraform)** | Plugin que permite a Terraform interactuar con una plataforma. |
| **S3** | Simple Storage Service. Almacenamiento de objetos de AWS. |
| **Serverless** | Modelo donde el proveedor maneja la infraestructura. Pagas por uso. |
| **UUID** | Universally Unique Identifier. ID prácticamente imposible de duplicar. |
| **x402** | Protocolo de micropagos HTTP basado en el código de estado 402. |

---

*Documento generado para el proyecto UltraPayx402. Última actualización: Diciembre 2025.*
