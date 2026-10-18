/* MyEV v22: safe file-only install.
 * Intentionally does NOT modify App.jsx; that file was not provided.
 * Run in your current MyEV root folder with the src/ and tools/ folder from this ZIP.
 */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const patchRoot = __dirname;
const files = [
  'src/components/MalaysiaChargingStations.jsx',
  'src/components/MalaysiaChargingStations.css',
  'tools/prepare_myev_charging_stations.py',
];
if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'src/App.jsx'))) {
  console.error('[MyEV v22] Please run this script from your MyEV project root (package.json + src/App.jsx).');
  process.exit(1);
}
for (const item of files) {
  if (!fs.existsSync(path.join(patchRoot, item))) {
    console.error(`[MyEV v22] Required patch file missing: ${item}`);
    process.exit(1);
  }
}
const folder = path.join(root, 'backup_charging_v22');
fs.mkdirSync(folder, { recursive: true });
for (const item of files) {
  const source = path.join(patchRoot, item);
  const destination = path.join(root, item);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) {
    const backup = path.join(folder, item);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(destination, backup);
  }
  fs.copyFileSync(source, destination);
  console.log('[MyEV v22] Installed:', item);
}
console.log('\n[MyEV v22] Done: component and generator files installed.');
console.log('IMPORTANT: App.jsx has NOT been changed (not supplied in components.zip).');
console.log('NEXT: Run `python tools/prepare_myev_charging_stations.py` to download real OSM records.');
console.log('NEXT: Integrate `<MalaysiaChargingStations />` into the Charging Network route in App.jsx.');
console.log('For a precise safe integration, share your current src/App.jsx.');
