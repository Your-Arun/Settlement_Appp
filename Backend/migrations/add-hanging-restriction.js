
const mongoose = require('mongoose');
const Member = require('../models/Member');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Add hangingRestriction field to all existing members
    await Member.updateMany(
      { hangingRestriction: { $exists: false } },
      { $set: { hangingRestriction: false } }
    );
    
    console.log('✅ Migration complete: hangingRestriction field added');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();