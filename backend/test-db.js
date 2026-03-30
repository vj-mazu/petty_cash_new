const { Sequelize } = require('sequelize');

const passwordsToTest = ['postgres', 'admin', 'root', '1234', 'password', '', '123456'];

async function checkPasswords() {
  console.log('Testing common PostgreSQL passwords...');
  for (const password of passwordsToTest) {
    try {
      const sequelize = new Sequelize('postgres', 'postgres', password, {
        host: 'localhost',
        dialect: 'postgres',
        logging: false,
        dialectOptions: { family: 4 }
      });
      await sequelize.authenticate();
      console.log(`✅ Success! The password is: "${password}"`);
      await sequelize.close();
      return password;
    } catch (e) {
      if (e.name === 'SequelizeConnectionError' && e.message.includes('password authentication failed')) {
        console.log(`❌ Failed password: "${password}"`);
      } else {
        console.log(`⚠️  Other error with password "${password}":`, e.message);
      }
    }
  }
  console.log('❌ Could not guess the password.');
  return null;
}

checkPasswords();
