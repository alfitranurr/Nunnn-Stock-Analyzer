const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Baca .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split(/\r?\n/);
const envVars = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  
  const key = trimmed.substring(0, eqIdx).trim();
  let value = trimmed.substring(eqIdx + 1).trim();
  
  // Hapus tanda kutip pembungkus jika ada
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1);
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.substring(1, value.length - 1);
  }
  
  if (key) {
    envVars.push({ key, value });
  }
}

console.log(`Menemukan ${envVars.length} variabel lingkungan di .env.local.`);

// Helper untuk menambahkan variabel lingkungan ke Vercel
function addEnv(key, value, env) {
  return new Promise((resolve) => {
    // Hapus variabel lama terlebih dahulu agar tidak error karena duplikat
    try {
      execSync(`npx vercel env remove "${key}" "${env}" -y`, { stdio: 'ignore' });
    } catch (e) {
      // Abaikan jika belum ada
    }

    console.log(`Mengunggah ${key} ke Vercel [${env}]...`);
    const child = spawn('npx', ['vercel', 'env', 'add', key, env], {
      shell: true,
      stdio: ['pipe', 'ignore', 'inherit']
    });

    child.stdin.write(value);
    child.stdin.end();

    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log('\n=== Langkah 1: Sinkronisasi Variabel Lingkungan ke Vercel ===');
  for (const { key, value } of envVars) {
    await addEnv(key, value, 'production');
    await addEnv(key, value, 'preview');
    await addEnv(key, value, 'development');
  }

  console.log('\n=== Langkah 2: Memulai Proses Deploy Produksi ke Vercel ===');
  const deployChild = spawn('npx', ['vercel', '--prod', '--yes'], {
    shell: true,
    stdio: 'inherit'
  });

  deployChild.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Proses Deploy Berhasil Selesai!');
    } else {
      console.error(`\n❌ Proses Deploy Gagal dengan exit code ${code}`);
      process.exit(code);
    }
  });
}

main();
