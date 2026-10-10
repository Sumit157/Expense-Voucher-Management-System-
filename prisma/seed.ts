// Development-only seed. Refuses to run in production without an explicit override.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PASSWORD_COST = 12;

const SEED_USERS = [
  {
    email: 'director@abc.test',
    fullName: 'Diana Director',
    role: 'DIRECTOR' as const,
    department: 'Executive',
    employeeCode: null,
  },
  {
    email: 'accounts@abc.test',
    fullName: 'Aaron Accounts',
    role: 'ACCOUNTS' as const,
    department: 'Finance',
    employeeCode: 'ACC-001',
  },
  {
    email: 'employee1@abc.test',
    fullName: 'Esha Employee',
    role: 'EMPLOYEE' as const,
    department: 'Operations',
    employeeCode: 'EMP-001',
  },
  {
    email: 'employee2@abc.test',
    fullName: 'Rohan Employee',
    role: 'EMPLOYEE' as const,
    department: 'Sales',
    employeeCode: 'EMP-002',
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed: set SEED_ALLOW_PRODUCTION=true to override in production');
  }

  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'SeedDevPassword123!';
  const passwordHash = await bcrypt.hash(password, PASSWORD_COST);
  const prisma = new PrismaClient();

  try {
    for (const seedUser of SEED_USERS) {
      await prisma.user.upsert({
        where: { email: seedUser.email },
        update: {
          fullName: seedUser.fullName,
          role: seedUser.role,
          department: seedUser.department,
          employeeCode: seedUser.employeeCode,
          isActive: true,
          passwordHash,
        },
        create: {
          email: seedUser.email,
          fullName: seedUser.fullName,
          role: seedUser.role,
          department: seedUser.department,
          employeeCode: seedUser.employeeCode,
          passwordHash,
        },
      });
      process.stdout.write(`seeded ${seedUser.role.padEnd(9)} ${seedUser.email}\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
