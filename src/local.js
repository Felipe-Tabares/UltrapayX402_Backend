/**
 * Servidor local para desarrollo
 * Ejecutar con: npm run dev
 */
const { app } = require('./index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`UltraPay Backend running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health    - Health check');
  console.log('  GET  /providers - List AI providers');
  console.log('  GET  /pricing   - Get pricing info');
  console.log('  POST /generate  - Generate image/video (requires x402 payment)');
});
