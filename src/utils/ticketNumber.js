/**
 * Generates the next ticket number in the form ITR-<year>-<0001>,
 * scoped per calendar year, e.g. ITR-2026-0001.
 */
async function nextTicketNumber(connection) {
  const year = new Date().getFullYear();
  const prefix = `ITR-${year}-`;

  const [rows] = await connection.query(
    `SELECT ticket_number FROM support_tickets
     WHERE ticket_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (rows.length) {
    const lastSeq = parseInt(rows[0].ticket_number.split('-')[2], 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

module.exports = { nextTicketNumber };
