Email Templates Editor & Preview
================================

Overview
--------
This document explains how to use the lightweight template editor and preview added to the project. The editor lets you edit the admin and client HTML email templates stored in `src/data`, preview rendered output, and save changes.

Files & locations
-----------------
- Templates (user-editable): `src/data/email_admin_template.html`, `src/data/email_client_template.html`
- Server default templates (fallback): `server/templates/admin_reservation.html`, `server/templates/client_reservation.html`
- Editor UI: `server/templates/email_templates_editor.html`
- Preview route and APIs: implemented in `server/server.js`

Available endpoints
-------------------
- `GET /admin/email-templates` — serves the editor UI page (browser page with two textareas)
- `GET /admin/email-templates/data` — returns JSON `{ admin, client }` with current template contents (prefers `src/data` files)
- `POST /admin/email-templates` — saves `{ admin, client }` JSON payload into `src/data/email_admin_template.html` and `src/data/email_client_template.html`
- `GET /admin/email-preview` — renders both admin and client templates with sample data and displays raw HTML; useful after editing

Placeholders available in templates
----------------------------------
Templates use simple `{{key}}` placeholders (string replacement). The server provides these keys when rendering reservation emails:

- `id`
- `created_at`
- `nom`, `prenom`, `email`, `telephone`
- `cheval_nom`
- `prestation_souhaitee`, `prestation_label`
- `date`, `time_range`
- `notes_html` (notes with newlines converted to `<br/>`)
- `admin_email`
- `entreprise_nom`
- `lieu`

Usage: edit, save, preview
---------------------------
1. Start the server (from project `server` folder):

```bash
cd "c:\Users\pierr\Documents\SiteWeb\ErgoGalop\server"
npm install
npm start
```

2. Open the editor in your browser:

http://localhost:3000/admin/email-templates

3. The editor loads current templates. Edit either template then click `Save` to write to `src/data`.

4. Click `Preview` to open the rendered templates at `/admin/email-preview` (opens a new tab).

Notes and recommendations
-------------------------
- The editor writes directly to files under `src/data`. Keep backups or commit changes to git before editing.
- If `src/data` templates are missing, the server falls back to `server/templates/*` defaults.
- To include images (logo) in emails, prefer hosted absolute URLs in the template (e.g., `https://.../logo.png`).
- For production, protect the `/admin/*` routes (basic auth, IP whitelist, or run the editor locally only).

Security & configuration
------------------------
- SMTP settings: `server/config/mail.json` — populate with your SMTP server and `admin_email`.
- Google service account key: referenced by `server/config/google.json` -> `service_account_key_path`. Keep these files out of version control.

Testing email send
------------------
- The templates are used when the server sends admin and client emails after a reservation is created via `POST /api/reservations`.
- To test end-to-end, create a reservation using your front-end form or `curl` to `POST /api/reservations` with the expected JSON body, then check the recipient mailboxes and `server/data/reservations.json`.

Troubleshooting
---------------
- Permission errors when saving: ensure the server process user has write access to `src/data`.
- Editor shows blank content: check `src/data` files exist or look at server logs for read errors.
- Emails not sent: verify `server/config/mail.json` contains valid SMTP settings and that `nodemailer` transporter was created without errors (check server console on startup).

Restoring defaults
------------------
If you want to restore the original templates, copy files from `server/templates/admin_reservation.html` and `server/templates/client_reservation.html` into `src/data` or remove the `src/data` files to allow fallback.

Next improvements (optional)
---------------------------
- Add basic auth or environment-protected access for `/admin/*` routes.
- Implement template backups/versioning on save.
- Add a live preview pane inside the editor (iframe) that updates as you type.

Contact
-------
If you want, I can add any of the optional improvements above — tell me which one and I'll implement it.
