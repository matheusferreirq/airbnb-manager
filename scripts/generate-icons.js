#!/usr/bin/env node

/**
 * Script para gerar ícones PNG a partir do SVG
 * Execute: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SVG_URL = 'https://api.cloudconvert.com/v2/convert';
const PUBLIC_DIR = path.join(__dirname, '../public');

// Criar diretório se não existir
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

console.log('📦 Gerando ícones PNG...');

// Método alternativo: usar sharp (instalável via npm)
// npm install sharp
// Se sharp estiver disponível, usar ele
try {
  const sharp = require('sharp');
  const svgBuffer = fs.readFileSync(path.join(PUBLIC_DIR, 'icon.svg'));
  
  // Gerar 192x192
  sharp(svgBuffer)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-192.png'))
    .then(() => console.log('✅ icon-192.png gerado'))
    .catch(err => console.error('❌ Erro ao gerar 192:', err));
  
  // Gerar 512x512
  sharp(svgBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-512.png'))
    .then(() => console.log('✅ icon-512.png gerado'))
    .catch(err => console.error('❌ Erro ao gerar 512:', err));
} catch (e) {
  console.log('⚠️  Sharp não instalado. Instalando...');
  console.log('   Execute: npm install sharp --save-dev');
  console.log('   Depois: node scripts/generate-icons.js');
}
