const { User, Ledger } = require('./models');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      where: { username: 'admin' }
    });

    if (!existingAdmin) {
      // Create admin user only
      await User.create({
        username: 'admin',
        email: 'admin@pettycash.local',
        password: 'Manjun@1234',
        role: 'admin'
      });

      console.log('✅ Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: Manjun@1234');
      console.log('');
    } else {
      console.log('✅ Admin user already exists');
    }

    console.log('🌱 Database seeding completed!');
    console.log('🚀 You can now start the application');
    console.log('💡 Create manager/staff users from the Users page after logging in as admin.');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

if (require.main === module) {
  seedDatabase().then(() => {
    console.log('✅ Seed process finished');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Seed process failed:', err);
    process.exit(1);
  });
}

module.exports = seedDatabase;