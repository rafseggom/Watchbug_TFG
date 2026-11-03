#!/usr/bin/env node
/**
 * Watchbug Phase 2 - Open browser to test reporting
 * 
 * Usage: node open-browser.mjs
 * 
 * This script opens the Watchbug panel in a new browser tab/window
 * using Playwright. Make sure Docker is running first:
 *   docker compose up -d --build
 */

import { chromium } from '@playwright/test';

(async () => {
  console.log('=== Watchbug - Abriendo navegador para testing ===\n');
  
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the panel
  console.log('Navegando a http://127.0.0.1:8080...');
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'domcontentloaded' });
  
  console.log('✓ Panel cargado en el navegador');
  console.log('');
  console.log('Lo que puedes hacer:');
  console.log('  1. Revisa los reportes existentes en el panel');
  console.log('  2. El widget debería estar visible (flotante)');
  console.log('  3. Puedes probar Reportes E2E con: npm run verify');
  console.log('');
  console.log('Para cerrar: Cierra la ventana del navegador o presiona Ctrl+C aquí.');
  
  // Keep running until user closes the browser
  // We'll wait for the page to close
  await page.waitForEvent('close');
  
  await browser.close();
  console.log('\n✓ Navegador cerrado.');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});