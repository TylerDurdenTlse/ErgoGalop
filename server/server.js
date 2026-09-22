const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const {google} = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(__dirname, 'config', 'google.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('Cannot read config/google.json', e);
}

// Mail config
const mailConfigPath = path.join(__dirname, 'config', 'mail.json');
let mailCfg = {};
try { mailCfg = JSON.parse(fs.readFileSync(mailConfigPath, 'utf8')); } catch (e) { mailCfg = {}; }

// Entreprise data (for fallback admin email)
let entreprise = {};
try { entreprise = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src', 'data', 'entreprise.json'), 'utf8')); } catch (e) { entreprise = {}; }

// Create transporter if SMTP configured
let transporter = null;
if (mailCfg && mailCfg.smtp && mailCfg.smtp.host) {
  try {
    transporter = nodemailer.createTransport(mailCfg.smtp);
  } catch (e) {
    console.error('Failed to create mail transporter', e);
    transporter = null;
  }
}

const horairesPath = path.join(projectRoot, 'src', 'data', 'horaires.json');
let horaires = {};
try {
  horaires = JSON.parse(fs.readFileSync(horairesPath, 'utf8'));
} catch (e) {
  console.error('Cannot read horaires.json', e);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return (aStart < bEnd) && (bStart < aEnd);
}

function pad(n){ return String(n).padStart(2,'0'); }
function formatTimeRange(startDate, durationMinutes){
  const end = new Date(startDate.getTime() + durationMinutes*60000);
  return `${pad(startDate.getHours())}:${pad(startDate.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function generateCandidatesForDate(dateStr) {
  // dateStr YYYY-MM-DD
  const weekdayKeys = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const dayIndex = new Date(dateStr + 'T00:00').getDay();
  const key = weekdayKeys[dayIndex];
  const jour = horaires.planning_hebdo?.[key];
  if (!jour || !jour.actif) return [];
  const ouverture = jour.ouverture; const fermeture = jour.fermeture;
  if (!ouverture || !fermeture) return [];
  const duree = horaires.duree_creneau_minutes || 90;
  const tampon = horaires.tampon_entre_rdv_minutes || 0;
  const step = duree + tampon;
  const startDay = new Date(`${dateStr}T${ouverture}:00`);
  const endDay = new Date(`${dateStr}T${fermeture}:00`);
  const candidates = [];
  for (let t = new Date(startDay); (t.getTime() + duree*60000) <= endDay.getTime(); t = new Date(t.getTime() + step*60000)) {
    candidates.push(new Date(t));
  }
  return {candidates, duree, startDay, endDay};
}

async function queryFreeBusyService(calendarId, timeMinISO, timeMaxISO) {
  // Load service account key
  const keyPath = path.resolve(__dirname, 'config', config.service_account_key_path || './service-account.json');
  let key = null;
  try {
    key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (e) {
    throw new Error('Service account key not found at ' + keyPath);
  }
  const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/calendar.readonly']
  );
  await jwtClient.authorize();
  const calendar = google.calendar({version: 'v3', auth: jwtClient});
  const resp = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: config.timeZone || 'Europe/Paris',
      items: [{id: calendarId}]
    }
  });
  return resp.data.calendars[calendarId] || {busy: []};
}

app.get('/api/freebusy', async (req, res) => {
  const date = req.query.date; // YYYY-MM-DD
  if (!date) return res.status(400).json({error: 'missing date param'});
  try {
    const {candidates, duree, startDay, endDay} = generateCandidatesForDate(date);
    if (!candidates.length) return res.json({available: [], busy: []});
    // Query freebusy
    const calendarId = config.calendar_id || 'primary';
    const fb = await queryFreeBusyService(calendarId, startDay.toISOString(), endDay.toISOString());
    const busy = fb.busy || [];
    const available = candidates.filter(c => {
      const slotStart = c.getTime();
      const slotEnd = slotStart + duree*60000;
      for (const b of busy) {
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        if (overlaps(slotStart, slotEnd, bStart, bEnd)) return false;
      }
      return true;
    }).map(c => formatTimeRange(c, duree));
    return res.json({available, busy});
  } catch (e) {
    console.error(e);
    return res.status(500).json({error: e.message || 'server error'});
  }
});

// POST reservation: validate and store
app.post('/api/reservations', async (req, res) => {
  /** Expected body (JSON):
   * {
   *   nom, prenom, email, telephone,
   *   cheval_nom, prestation_souhaitee,
   *   date: 'YYYY-MM-DD', time_range: 'HH:MM - HH:MM', notes?: string
   * }
   */
  const body = req.body || {};
  const required = ['nom','prenom','email','telephone','cheval_nom','prestation_souhaitee','date','time_range'];
  const missing = required.filter(k => !body[k]);
  if (missing.length) return res.status(400).json({ error: 'missing_fields', fields: missing });

  // Basic validation
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRe.test(body.email)) return res.status(400).json({ error: 'invalid_email' });

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return res.status(400).json({ error: 'invalid_date' });

  // Recompute available slots for the date
  try {
    const {candidates, duree} = generateCandidatesForDate(body.date);
    if (!candidates || !candidates.length) return res.status(400).json({ error: 'date_not_worked' });

    // get busy via service account
    const calendarId = config.calendar_id || 'primary';
    const startDay = new Date(`${body.date}T00:00:00`);
    const endDay = new Date(`${body.date}T23:59:59`);
    const fb = await queryFreeBusyService(calendarId, startDay.toISOString(), endDay.toISOString());
    const busy = fb.busy || [];

    // Check that the requested time_range is among available (format match)
    const formattedCandidates = candidates.map(c => formatTimeRange(c, duree));
    if (!formattedCandidates.includes(body.time_range)) {
      return res.status(400).json({ error: 'slot_not_available', available: formattedCandidates });
    }

    // Persist reservation
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const storePath = path.join(dataDir, 'reservations.json');
    let store = [];
    try { store = JSON.parse(fs.readFileSync(storePath, 'utf8') || '[]'); } catch (e) { store = []; }

    const reservation = {
      id: `res_${Date.now()}`,
      created_at: new Date().toISOString(),
      nom: body.nom,
      prenom: body.prenom,
      email: body.email,
      telephone: body.telephone,
      cheval_nom: body.cheval_nom,
      prestation_souhaitee: body.prestation_souhaitee,
      date: body.date,
      time_range: body.time_range,
      notes: body.notes || ''
    };

    store.push(reservation);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');

    // Send notification emails (admin + client) if transporter available
    const adminEmail = (mailCfg && mailCfg.admin_email) || entreprise.contact?.email || 'contact@example.com';
    const fromAddress = (mailCfg && mailCfg.from) || `ErgoGalop <noreply@${(mailCfg && mailCfg.smtp && mailCfg.smtp.host) || 'ergogalop.fr'}>`;
    const adminSubject = `Nouvelle réservation — ${reservation.date} ${reservation.time_range}`;
    const clientSubject = `Confirmation de réservation — ${reservation.date} ${reservation.time_range}`;

    // Prefer templates placed in project src/data (editable by the user), fallback to server/templates
    const userAdminTpl = path.join(projectRoot, 'src', 'data', 'email_admin_template.html');
    const userClientTpl = path.join(projectRoot, 'src', 'data', 'email_client_template.html');
    const templatesDir = path.join(__dirname, 'templates');
    const adminTplPath = fs.existsSync(userAdminTpl) ? userAdminTpl : path.join(templatesDir, 'admin_reservation.html');
    const clientTplPath = fs.existsSync(userClientTpl) ? userClientTpl : path.join(templatesDir, 'client_reservation.html');

    function renderTemplate(tplPath, data) {
      try {
        let tpl = fs.readFileSync(tplPath, 'utf8');
        Object.keys(data).forEach(k => {
          const re = new RegExp(`{{${k}}}`, 'g');
          tpl = tpl.replace(re, data[k] == null ? '' : data[k]);
        });
        return tpl;
      } catch (e) { return null; }
    }

    // Try to resolve prestation label from src/data/prestations.json
    let prestation_label = reservation.prestation_souhaitee;
    try {
      const presPath = path.join(projectRoot, 'src', 'data', 'prestations.json');
      if (fs.existsSync(presPath)) {
        const presRaw = fs.readFileSync(presPath, 'utf8');
        const presJson = JSON.parse(presRaw);
        // prestations.json can be an array or an object with categories
        if (Array.isArray(presJson)) {
          const found = presJson.find(p => p.id === reservation.prestation_souhaitee);
          if (found) prestation_label = found.titre || found.nom || prestation_label;
        } else if (presJson.categories && Array.isArray(presJson.categories)) {
          for (const cat of presJson.categories) {
            const found = (cat.services || []).find(s => s.id === reservation.prestation_souhaitee);
            if (found) { prestation_label = found.titre || found.nom || prestation_label; break; }
          }
        }
      }
    } catch (e) {
      // ignore, use id as label
    }

    const dataForTpl = Object.assign({}, reservation, {
      admin_email: adminEmail,
      notes_html: (reservation.notes || '').replace(/\n/g, '<br/>'),
      prestation_label,
      entreprise_nom: entreprise.nom_marque || '' ,
      lieu: entreprise.siege_social?.adresse || ''
    });

    const adminHtml = renderTemplate(adminTplPath, dataForTpl);
    const clientHtml = renderTemplate(clientTplPath, dataForTpl);

    const sendResult = { admin: false, client: false, errors: [] };
    if (transporter) {
      try {
        await transporter.sendMail({ from: fromAddress, to: adminEmail, subject: adminSubject, text: adminHtml ? adminHtml.replace(/<[^>]+>/g,'') : '', html: adminHtml });
        sendResult.admin = true;
      } catch (e) { sendResult.errors.push({ admin: e.message }); }

      try {
        await transporter.sendMail({ from: fromAddress, to: reservation.email, subject: clientSubject, text: clientHtml ? clientHtml.replace(/<[^>]+>/g,'') : '', html: clientHtml });
        sendResult.client = true;
      } catch (e) { sendResult.errors.push({ client: e.message }); }
    }

    return res.json({ ok: true, reservation, email: sendResult });
  } catch (e) {
    console.error('Reservation error', e);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Admin preview: render admin and client templates with sample data
app.get('/admin/email-preview', async (req, res) => {
  try {
    const userAdminTpl = path.join(projectRoot, 'src', 'data', 'email_admin_template.html');
    const userClientTpl = path.join(projectRoot, 'src', 'data', 'email_client_template.html');
    const templatesDir = path.join(__dirname, 'templates');
    const adminTplPath = fs.existsSync(userAdminTpl) ? userAdminTpl : path.join(templatesDir, 'admin_reservation.html');
    const clientTplPath = fs.existsSync(userClientTpl) ? userClientTpl : path.join(templatesDir, 'client_reservation.html');

    function renderTemplate(tplPath, data) {
      try {
        let tpl = fs.readFileSync(tplPath, 'utf8');
        Object.keys(data).forEach(k => {
          const re = new RegExp(`{{${k}}}`, 'g');
          tpl = tpl.replace(re, data[k] == null ? '' : data[k]);
        });
        return tpl;
      } catch (e) { return null; }
    }

    // sample reservation data
    const sample = {
      id: 'preview_12345',
      created_at: new Date().toISOString(),
      nom: 'Dupont',
      prenom: 'Julie',
      email: 'julie.dupont@example.com',
      telephone: '+33 6 12 34 56 78',
      cheval_nom: 'Eclair',
      prestation_souhaitee: 'formation-initiation',
      date: new Date().toISOString().slice(0,10),
      time_range: '09:00 - 10:30',
      notes: 'Préférence pour la matinée. Cheval sensible au bruit.'
    };

    // Resolve prestation label if present
    let prestation_label = sample.prestation_souhaitee;
    try {
      const presPath = path.join(projectRoot, 'src', 'data', 'prestations.json');
      if (fs.existsSync(presPath)) {
        const presJson = JSON.parse(fs.readFileSync(presPath, 'utf8'));
        if (Array.isArray(presJson)) {
          const found = presJson.find(p => p.id === sample.prestation_souhaitee);
          if (found) prestation_label = found.titre || found.nom || prestation_label;
        }
      }
    } catch (e) {}

    const dataForTpl = Object.assign({}, sample, {
      admin_email: (mailCfg && mailCfg.admin_email) || entreprise.contact?.email || 'contact@example.com',
      notes_html: (sample.notes || '').replace(/\n/g, '<br/>'),
      prestation_label,
      entreprise_nom: entreprise.nom_marque || 'ErgoGalop',
      lieu: entreprise.siege_social?.adresse || 'Siège social'
    });

    const adminHtml = renderTemplate(adminTplPath, dataForTpl) || '<pre>Template load failed</pre>';
    const clientHtml = renderTemplate(clientTplPath, dataForTpl) || '<pre>Template load failed</pre>';

    // Simple preview page showing both templates and raw html
    const page = `<!doctype html><html><head><meta charset="utf-8"/><title>Email preview</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:20px} .col{display:flex;gap:20px} .box{flex:1;border:1px solid #ddd;padding:12px;border-radius:8px;background:#fff} pre{white-space:pre-wrap;background:#f7fafc;padding:8px;border-radius:6px;overflow:auto}</style></head><body><h1>Email templates preview</h1><div class="col"><div class="box"><h2>Admin</h2>${adminHtml}<h3>Raw HTML</h3><pre>${escapeHtml(adminHtml)}</pre></div><div class="box"><h2>Client</h2>${clientHtml}<h3>Raw HTML</h3><pre>${escapeHtml(clientHtml)}</pre></div></div></body></html>`;

    function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    res.send(page);
  } catch (e) {
    console.error('Preview error', e);
    res.status(500).send('Preview error: ' + e.message);
  }
});

// Serve the editor UI page
app.get('/admin/email-templates', (req, res) => {
  const editorPath = path.join(__dirname, 'templates', 'email_templates_editor.html');
  if (fs.existsSync(editorPath)) return res.sendFile(editorPath);
  res.status(404).send('Editor not found');
});

// API: get current templates (prefer src/data)
app.get('/admin/email-templates/data', (req, res) => {
  try {
    const userAdminTpl = path.join(projectRoot, 'src', 'data', 'email_admin_template.html');
    const userClientTpl = path.join(projectRoot, 'src', 'data', 'email_client_template.html');
    let admin = '';
    let client = '';
    if (fs.existsSync(userAdminTpl)) admin = fs.readFileSync(userAdminTpl, 'utf8');
    if (fs.existsSync(userClientTpl)) client = fs.readFileSync(userClientTpl, 'utf8');
    return res.json({ admin, client });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message }); }
});

// API: save templates into src/data (overwrites files)
app.post('/admin/email-templates', (req, res) => {
  try {
    const body = req.body || {};
    const admin = body.admin || '';
    const client = body.client || '';
    const dataDir = path.join(projectRoot, 'src', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const adminPath = path.join(dataDir, 'email_admin_template.html');
    const clientPath = path.join(dataDir, 'email_client_template.html');
    fs.writeFileSync(adminPath, admin, 'utf8');
    fs.writeFileSync(clientPath, client, 'utf8');
    return res.json({ ok: true, paths: { admin: adminPath, client: clientPath } });
  } catch (e) { console.error('Save templates error', e); return res.status(500).json({ error: e.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
