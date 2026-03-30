require('dotenv').config();
const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  try {
    const plainPassword = 'Manjun@1234';
    
    // Check if admin exists
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin) {
      await admin.update({ password: plainPassword });
      console.log('✅ Updated existing admin password to: Manjun@1234');
    } else {
      await User.create({
        username: 'admin',
        email: 'admin@pettycash.local',
        password: plainPassword,
        role: 'admin'
      });
      console.log('✅ Created admin user with password: Manjun@1234');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

resetAdminPassword();
