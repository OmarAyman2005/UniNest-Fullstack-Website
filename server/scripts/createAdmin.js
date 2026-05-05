
import '../src/config/env.js';             
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const [,, fullName = 'Admin User', email = 'admin@example.com', password = 'Admin#123'] = process.argv;

(async () => {
  try {
    await connectDB();

    const exists = await User.findOne({ email });
    if (exists) {
      console.log('Admin already exists');
      process.exit(0);
    }

    await User.create({ fullName, email, password, role: 'admin', isVerified: true });
    console.log('✅ Admin created:', email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
    process.exit(1);
  }
})();
