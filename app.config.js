// Configuração dinâmica: usa o arquivo do Firebase quando ele existir
// (necessário só para notificações com o app fechado no Android).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(firebase)) config.android = { ...config.android, googleServicesFile: './google-services.json' };
  return config;
};
