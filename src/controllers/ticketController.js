const pool = require('../config/db');
const { nextTicketNumber } = require('../utils/ticketNumber');

const VALID_STATUSES = ['Open', 'Under Review', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'];

// ---------------------------------------------------------------- create
async function createTicket(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const {
      categoryId, title, description, errorMessage, whenStarted,
      troubleshootingAttempted, deviceType, deviceModel, operatingSystem, supportType
    } = req.body;

    if (!categoryId || !title || !description || !supportType) {
      connection.release();
      return res.status(400).json({ error: 'Category, title, description, and support type are required.' });
    }

    await connection.beginTransaction();

    const ticketNumber = await nextTicketNumber(connection);
    const [result] = await connection.query(
      `INSERT INTO support_tickets
        (ticket_number, user_id, category_id, title, description, error_message,
         when_started, troubleshooting_attempted, device_type, device_model,
         operating_system, support_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')`,
      [ticketNumber, req.auth.id, categoryId, title, description, errorMessage || null,
       whenStarted || null, troubleshootingAttempted || null, deviceType || null,
       deviceModel || null, operatingSystem || null, supportType]
    );

    const ticketId = result.insertId;

    if (req.file) {
      await connection.query(
        `INSERT INTO ticket_attachments
          (ticket_id, file_name, file_path, mime_type, file_size_bytes, uploaded_by_type, uploaded_by_id)
         VALUES (?, ?, ?, ?, ?, 'user', ?)`,
        [ticketId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.auth.id]
      );
    }

    await connection.commit();

    res.status(201).json({
      ticket: { id: ticketId, ticketNumber, status: 'Open' }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

// ------------------------------------------------------------------ list
// Customers see only their own tickets. Admins see all tickets and can
// filter by status, category, and a free-text search over title/ticket number.
async function listTickets(req, res, next) {
  try {
    const { status, categoryId, search, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];

    if (req.auth.type === 'user') {
      where.push('t.user_id = ?');
      params.push(req.auth.id);
    }
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }
    if (categoryId) {
      where.push('t.category_id = ?');
      params.push(categoryId);
    }
    if (search) {
      where.push('(t.title LIKE ? OR t.ticket_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Number(pageSize) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const [rows] = await pool.query(
      `SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.support_type,
              t.created_at, t.updated_at,
              c.name AS category_name,
              u.name AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN categories c ON c.id = t.category_id
       JOIN users u ON u.id = t.user_id
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM support_tickets t ${whereSql}`,
      params
    );

    res.json({ tickets: rows, page: Number(page), pageSize: limit, total });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------- detail
async function getTicket(req, res, next) {
  try {
    const { id } = req.params;
    const [tickets] = await pool.query(
      `SELECT t.*, c.name AS category_name, u.name AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN categories c ON c.id = t.category_id
       JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
      [id]
    );
    const ticket = tickets[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    if (req.auth.type === 'user' && ticket.user_id !== req.auth.id) {
      return res.status(403).json({ error: 'You do not have access to this ticket.' });
    }

    const [messages] = await pool.query(
      `SELECT id, sender_type, sender_id, message, created_at
       FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );
    const [attachments] = await pool.query(
      `SELECT id, message_id, file_name, file_path, mime_type, uploaded_by_type, created_at
       FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );

    res.json({ ticket, messages, attachments });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------- status / priority
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, priority, assignedAdminId } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const [tickets] = await pool.query('SELECT user_id FROM support_tickets WHERE id = ?', [id]);
    if (!tickets[0]) return res.status(404).json({ error: 'Ticket not found.' });

    const fields = [];
    const params = [];
    if (status) { fields.push('status = ?'); params.push(status); }
    if (priority) { fields.push('priority = ?'); params.push(priority); }
    if (assignedAdminId !== undefined) { fields.push('assigned_admin_id = ?'); params.push(assignedAdminId); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

    params.push(id);
    await pool.query(`UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`, params);

    if (status) {
      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message)
         VALUES (?, 'system', ?, ?)`,
        [id, req.auth.id, `Status changed to "${status}".`]
      );
      await pool.query(
        `INSERT INTO notifications (user_id, ticket_id, type, message)
         VALUES (?, ?, 'status_change', ?)`,
        [tickets[0].user_id, id, `Your ticket status changed to "${status}".`]
      );
    }

    res.json({ message: 'Ticket updated.' });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------- messages
async function addMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const [tickets] = await pool.query('SELECT user_id FROM support_tickets WHERE id = ?', [id]);
    const ticket = tickets[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (req.auth.type === 'user' && ticket.user_id !== req.auth.id) {
      return res.status(403).json({ error: 'You do not have access to this ticket.' });
    }

    const [result] = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message)
       VALUES (?, ?, ?, ?)`,
      [id, req.auth.type, req.auth.id, message.trim()]
    );

    if (req.file) {
      await pool.query(
        `INSERT INTO ticket_attachments
          (ticket_id, message_id, file_name, file_path, mime_type, file_size_bytes, uploaded_by_type, uploaded_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, result.insertId, req.file.originalname, req.file.filename, req.file.mimetype,
         req.file.size, req.auth.type, req.auth.id]
      );
    }

    if (req.auth.type === 'admin') {
      await pool.query(
        `INSERT INTO notifications (user_id, ticket_id, type, message)
         VALUES (?, ?, 'new_reply', 'An IT specialist replied to your ticket.')`,
        [ticket.user_id, id]
      );
    }

    res.status(201).json({ message: 'Reply added.', messageId: result.insertId });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTicket, listTickets, getTicket, updateStatus, addMessage, VALID_STATUSES };
