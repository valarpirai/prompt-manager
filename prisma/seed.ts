import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default admin user
  const adminEmail = 'admin@example.com';
  const adminPassword = 'test1234';

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('🔍 Admin user already exists, skipping creation...');
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      display_name: 'Administrator',
      is_verified: true,
    },
  });

  console.log('✅ Admin user created successfully:');
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   ID: ${adminUser.id}`);

  // Create some sample prompts for the admin user
  const samplePrompts = [
    {
      title: 'Code Review Assistant',
      prompt_text: `You are an expert code reviewer. Please review the following code and provide feedback on:

1. Code quality and best practices
2. Potential bugs or security issues
3. Performance optimizations
4. Readability and maintainability
5. Suggestions for improvement

Please be constructive and specific in your feedback.

Code to review:
[INSERT CODE HERE]`,
      tags: ['code-review', 'programming', 'development'],
      visibility: 'PUBLIC' as const,
    },
    {
      title: 'Technical Writing Assistant',
      prompt_text: `You are a technical writing expert. Help me create clear, concise, and well-structured technical documentation.

Please help with:
- Organizing information logically
- Using appropriate technical terminology
- Creating clear step-by-step instructions
- Adding relevant examples and code snippets
- Ensuring the content is accessible to the target audience

Topic: [INSERT TOPIC HERE]
Target audience: [INSERT AUDIENCE HERE]`,
      tags: ['technical-writing', 'documentation', 'communication'],
      visibility: 'PUBLIC' as const,
    },
    {
      title: 'SQL Query Optimizer',
      prompt_text: `You are a database expert specializing in SQL optimization. Please help me optimize the following SQL query for better performance.

Please analyze:
1. Query structure and logic
2. Index usage opportunities
3. Join optimization
4. WHERE clause efficiency
5. Potential query rewriting

Provide the optimized query with explanations for each improvement.

Original query:
[INSERT SQL QUERY HERE]

Database system: [INSERT DB TYPE HERE]
Table sizes: [INSERT TABLE INFO HERE]`,
      tags: ['sql', 'database', 'optimization', 'performance'],
      visibility: 'PUBLIC' as const,
    },
    {
      title: 'Meeting Summary Generator',
      prompt_text: `You are an expert at summarizing meetings and extracting key information. Please create a structured summary of the following meeting notes.

Format the summary with:
1. **Meeting Overview** (date, attendees, purpose)
2. **Key Discussion Points** (main topics discussed)
3. **Decisions Made** (concrete decisions and outcomes)
4. **Action Items** (tasks assigned with owners and deadlines)
5. **Next Steps** (follow-up meetings, deadlines, etc.)

Make the summary clear, actionable, and easy to share with stakeholders.

Meeting notes:
[INSERT MEETING NOTES HERE]`,
      tags: ['meeting', 'summary', 'productivity', 'business'],
      visibility: 'PRIVATE' as const,
    },
  ];

  // Create sample tags first
  const allTags = [...new Set(samplePrompts.flatMap((prompt) => prompt.tags))];
  const createdTags = await Promise.all(
    allTags.map((tagName) =>
      prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      })
    )
  );

  // Create sample prompts
  for (const promptData of samplePrompts) {
    const promptTags = createdTags.filter((tag) =>
      promptData.tags.includes(tag.name)
    );

    const prompt = await prisma.prompt.create({
      data: {
        title: promptData.title,
        prompt_text: promptData.prompt_text,
        visibility: promptData.visibility,
        owner_id: adminUser.id,
        created_by: adminUser.id,
        tags: {
          connect: promptTags.map((tag) => ({ id: tag.id })),
        },
      },
    });

    // Create version history
    await prisma.promptVersion.create({
      data: {
        prompt_id: prompt.id,
        title: promptData.title,
        prompt_text: promptData.prompt_text,
        version: 1,
        created_by: adminUser.id,
        tags: {
          connect: promptTags.map((tag) => ({ id: tag.id })),
        },
      },
    });

    console.log(`📝 Created sample prompt: ${prompt.title}`);
  }

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('🔑 Default login credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
