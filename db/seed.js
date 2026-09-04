/**
 * Seeds a demo admin user and a handful of knowledge base articles.
 * Run with: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

async function seed() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  // --- demo admin ---
  const adminPassword = await bcrypt.hash('ChangeMe123!', saltRounds);
  await pool.query(
    `INSERT INTO admin_users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    ['ITResolve Admin', 'admin@itresolve.local', adminPassword]
  );
  console.log('Seeded admin user: admin@itresolve.local / ChangeMe123!');

  // --- knowledge base articles ---
  const [categories] = await pool.query('SELECT id, slug FROM categories');
  const bySlug = Object.fromEntries(categories.map(c => [c.slug, c.id]));

  const articles = [
    {
      cat: 'windows-software',
      title: 'How to fix a slow Windows computer',
      slug: 'fix-slow-windows-computer',
      summary: 'Speed up a sluggish Windows PC with these checks.',
      content: 'Check startup programs, run Disk Cleanup, verify available disk space, scan for malware, and confirm Windows Update is not stuck mid-install.'
    },
    {
      cat: 'printer-support',
      title: 'How to troubleshoot a printer that is offline',
      slug: 'printer-offline-troubleshooting',
      summary: 'Bring an "offline" printer back online.',
      content: 'Confirm the printer is powered on and connected, set it as the default printer, clear the print spooler, and reinstall the printer driver if needed.'
    },
    {
      cat: 'network-internet',
      title: 'How to fix Wi-Fi connected but no internet',
      slug: 'wifi-connected-no-internet',
      summary: 'Connected to Wi-Fi but pages will not load.',
      content: 'Restart the router and device, forget and rejoin the network, flush DNS, and check whether other devices on the same network are affected.'
    },
    {
      cat: 'hardware-peripherals',
      title: 'How to troubleshoot USB devices not recognized',
      slug: 'usb-device-not-recognized',
      summary: 'A USB device stops being detected.',
      content: 'Try a different port, update or reinstall the USB controller drivers, test the device on another machine, and check Device Manager for errors.'
    },
    {
      cat: 'windows-software',
      title: 'How to fix common Windows update problems',
      slug: 'fix-windows-update-problems',
      summary: 'Updates failing, stuck, or looping.',
      content: 'Run the Windows Update troubleshooter, clear the SoftwareDistribution cache, free up disk space, and check for pending restarts.'
    }
  ];

  for (const a of articles) {
    await pool.query(
      `INSERT INTO knowledge_base_articles (category_id, title, slug, summary, content)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      [bySlug[a.cat], a.title, a.slug, a.summary, a.content]
    );
  }
  console.log(`Seeded ${articles.length} knowledge base articles.`);

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
