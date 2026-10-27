import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { User } from '../models/User.js';
import { ROLES, USER_STATUS } from '../constants/index.js';

export const seedAdminUser = async (): Promise<void> => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({
      $or: [
        { email: ENV.INITIAL_ADMIN_EMAIL.toLowerCase() },
        { role: ROLES.ADMIN },
      ],
    });

    if (existingAdmin) {
      console.log(`[Seed] Admin user already exists: ${existingAdmin.email} (${existingAdmin.employeeId})`);
      return;
    }

    console.log(`[Seed] Creating initial administrator account: ${ENV.INITIAL_ADMIN_EMAIL}...`);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ENV.INITIAL_ADMIN_PASSWORD, salt);

    const admin = await User.create({
      name: ENV.INITIAL_ADMIN_NAME,
      email: ENV.INITIAL_ADMIN_EMAIL.toLowerCase(),
      employeeId: ENV.INITIAL_ADMIN_EMP_ID,
      role: ROLES.ADMIN,
      department: ENV.INITIAL_ADMIN_DEPT,
      status: USER_STATUS.ACTIVE,
      passwordHash,
      mustChangePassword: false,
    });

    console.log(`=======================================================`);
    console.log(`✅ Administrator Account Provisioned Successfully:`);
    console.log(`   Email:       ${admin.email}`);
    console.log(`   Employee ID: ${admin.employeeId}`);
    console.log(`   Name:        ${admin.name}`);
    console.log(`   Password:    ${ENV.INITIAL_ADMIN_PASSWORD}`);
    console.log(`=======================================================`);
  } catch (error) {
    console.error('[Seed] Error seeding administrator user:', error);
    throw error;
  }
};

// Execute if run directly
if (process.argv[1]?.endsWith('seedAdmin.ts') || process.argv[1]?.endsWith('seedAdmin.js')) {
  seedAdminUser()
    .then(() => disconnectDB())
    .catch(() => process.exit(1));
}
