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
    const { employeeId, changes, reason } = req.body;
    
    console.log('[employee-edits] Received body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!employeeId) {
      return res.status(400).json({ message: 'Missing employeeId' });
    }
    if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'Missing changes object or changes is empty' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Missing reason' });
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({ 
      where: { id: employeeId } 
    });
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log(`[employee-edits] Creating edit suggestion with ${Object.keys(changes).length} field changes`);

    // Create a single EmployeeEdit record with changes stored as JSON
    const employeeEdit = await prisma.employeeEdit.create({
      data: {
        employeeId,
        submittedById: req.user.id,
        changes, // Store as JSON in the database
        reason,
        status: 'pending'
      }
    });

    await logActivity(
      req.user.id, 
      `Submitted edit suggestion for employee ${employee.full_name || employeeId}`
    );

    res.status(201).json({ 
      message: 'Edit suggestion submitted successfully',
      data: employeeEdit
    });

  } catch (error) {
    console.error('Error creating employee edit:', error);
    res.status(500).json({ 
      message: 'Error submitting edit suggestion',
      error: error.message 
    });
  }
}

module.exports = { list, create };
