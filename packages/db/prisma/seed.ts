import { PrismaClient, UserRole, RiskAppetite, OpportunityStage } from '@prisma/client';
import { createHash, randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stonegate.local' },
    update: {},
    create: {
      email: 'admin@stonegate.local',
      name: 'Stone Gate Admin',
      passwordHash: hashPassword('changeme'),
      role: UserRole.ADMIN,
    },
  });

  const principal = await prisma.user.upsert({
    where: { email: 'principal@stonegate.local' },
    update: {},
    create: {
      email: 'principal@stonegate.local',
      name: 'Senior Principal',
      passwordHash: hashPassword('changeme'),
      role: UserRole.PRINCIPAL,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      name: 'Aurelian Family Office',
      type: 'family_office',
      contactEmail: 'family@aurelian.example',
      riskAppetite: RiskAppetite.CORE_PLUS,
      timeHorizonYears: 7,
      geographyPrefs: ['UK', 'EU-Tier1', 'US-Sunbelt'],
      sectorPrefs: ['Industrial', 'Multifamily', 'Life Sciences'],
      leverageMaxLtv: 0.55,
      mandateSummary:
        'Core-plus mandate with appetite for value-add upside in supply-constrained markets. Avoids speculative office and ground-up retail.',
    },
  });

  await prisma.opportunity.upsert({
    where: { id: 'seed-opp-1' },
    update: {},
    create: {
      id: 'seed-opp-1',
      clientId: client.id,
      name: 'Project Meridian — Madrid Logistics Portfolio',
      sponsor: 'Iberian Industrial Partners',
      propertyType: 'Industrial',
      subType: 'Last-Mile Logistics',
      geography: 'EU',
      city: 'Madrid',
      country: 'Spain',
      size: '420,000 sqm',
      askingEquity: 180_000_000 as unknown as number,
      totalCapitalization: 540_000_000 as unknown as number,
      targetIrr: 14.5 as unknown as number,
      targetMoic: 1.9 as unknown as number,
      holdPeriodYears: 5,
      stage: OpportunityStage.UNDER_REVIEW,
    },
  });

  // eslint-disable-next-line no-console
  console.log({ admin: admin.email, principal: principal.email });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
