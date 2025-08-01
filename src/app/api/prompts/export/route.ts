import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    // Get all prompts owned by the user (not deleted)
    const prompts = await prisma.prompt.findMany({
      where: {
        owner_id: req.user!.userId,
        deleted_at: null,
      },
      select: {
        title: true,
        prompt_text: true,
        visibility: true,
        created_at: true,
        updated_at: true,
        tags: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Convert to CSV format
    const csvHeaders = 'Name,Text,Visibility,Tags,Created At,Updated At';
    const csvRows = prompts.map((prompt) => {
      const tags = prompt.tags.map((tag) => tag.name).join(';');
      const name = `"${prompt.title.replace(/"/g, '""')}"`;
      const text = `"${prompt.prompt_text.replace(/"/g, '""')}"`;
      const visibility = prompt.visibility;
      const createdAt = prompt.created_at.toISOString();
      const updatedAt = prompt.updated_at.toISOString();
      const tagsField = tags ? `"${tags}"` : '""';

      return `${name},${text},${visibility},${tagsField},${createdAt},${updatedAt}`;
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `prompts-export-${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export prompts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
