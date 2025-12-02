const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

async function list(req, res) {
  const { status, submittedById } = req.query;
  const where = { ...(status ? { status } : {}), ...(submittedById ? { submittedById } : {}) };
  
  try {
    const items = await prisma.employeeEdit.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            rank: true,
            department: true
          }
        }
      }
    });
    res.json(items);
  } catch (error) {
    console.error('Error listing edits:', error);
    res.status(500).json({ message: 'Error listing edits' });
  }
}

async function create(req, res) {
  try {
    const body = req.body;
    console.log('[employee-edits] Received body:', JSON.stringify(body, null, 2));

    let editsToCreate = [];
    let employeeId, reason;

    // Check if it's a Batch Edit (has 'changes' object)
    if (body.changes && typeof body.changes === 'object') {
      console.log('[employee-edits] Processing BATCH edit');
      employeeId = body.employeeId;
      reason = body.reason;

      if (!employeeId || !reason) {
        return res.status(400).json({ message: 'Missing employeeId or reason' });
      }

      // Get current employee data for oldValue
      const currentEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!currentEmployee) return res.status(404).json({ message: 'Employee not found' });

      editsToCreate = Object.entries(body.changes).map(([field, newValue]) => ({
        employeeId,
        submittedById: req.user.id,
        field,
        oldValue: String(currentEmployee[field] || ''),
        newValue: String(newValue),
        reason,
        status: 'pending'
      }));

    } else {
      console.log('[employee-edits] Processing SINGLE edit');
      // Single Edit fallback
      const { field, oldValue, newValue } = body;
      employeeId = body.employeeId;
      reason = body.reason;

      if (!employeeId || !field || !newValue || !reason) {
        return res.status(400).json({ message: 'Missing required fields for single edit' });
      }

      editsToCreate.push({
        employeeId,
        submittedById: req.user.id,
        field,
        oldValue: String(oldValue || ''),
        newValue: String(newValue),
        reason,
        status: 'pending'
      });
    }

    if (editsToCreate.length === 0) {
      return res.status(400).json({ message: 'No changes detected' });
    }

    console.log(`[employee-edits] Saving ${editsToCreate.length} edits...`);

    // Save all edits to database
    await prisma.$transaction(
      editsToCreate.map(data => prisma.employeeEdit.create({ data }))
    );

    await logActivity(req.user.id, `Submitted ${editsToCreate.length} edits for employee`);
    res.status(201).json({ message: 'Edits submitted successfully' });

  } catch (error) {
    console.error('Error creating edit:', error);
    res.status(500).json({ message: 'Error submitting edit' });
  }
}

module.exports = { list, create };
