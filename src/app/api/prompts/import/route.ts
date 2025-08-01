import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { validatePromptTitle, validatePromptText } from '@/lib/validation'

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV file' }, { status: 400 })
    }

    const csvText = await file.text()
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line)
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must contain at least a header and one data row' }, { status: 400 })
    }

    // Parse CSV headers (case insensitive)
    const headerLine = lines[0].toLowerCase()
    const headers = parseCSVLine(headerLine)
    
    // Check for required columns
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'title')
    const textIndex = headers.findIndex(h => h === 'text' || h === 'prompt_text' || h === 'prompt text')
    
    if (nameIndex === -1) {
      return NextResponse.json({ error: 'CSV must contain a "Name" or "Title" column' }, { status: 400 })
    }
    
    if (textIndex === -1) {
      return NextResponse.json({ error: 'CSV must contain a "Text", "Prompt_Text", or "Prompt Text" column' }, { status: 400 })
    }

    // Optional columns
    const visibilityIndex = headers.findIndex(h => h === 'visibility')
    const tagsIndex = headers.findIndex(h => h === 'tags')

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue

      try {
        const values = parseCSVLine(line)
        
        if (values.length < Math.max(nameIndex, textIndex) + 1) {
          results.errors.push(`Row ${i + 1}: Insufficient columns`)
          results.skipped++
          continue
        }

        const title = values[nameIndex]?.trim()
        const promptText = values[textIndex]?.trim()
        
        if (!title || !promptText) {
          results.errors.push(`Row ${i + 1}: Missing title or text`)
          results.skipped++
          continue
        }

        // Validate title and text
        const titleValidation = validatePromptTitle(title)
        if (!titleValidation.valid) {
          results.errors.push(`Row ${i + 1}: ${titleValidation.error}`)
          results.skipped++
          continue
        }

        const textValidation = validatePromptText(promptText)
        if (!textValidation.valid) {
          results.errors.push(`Row ${i + 1}: ${textValidation.error}`)
          results.skipped++
          continue
        }

        // Parse visibility (default to PRIVATE)
        let visibility = 'PRIVATE'
        if (visibilityIndex !== -1 && values[visibilityIndex]) {
          const visibilityValue = values[visibilityIndex].trim().toUpperCase()
          if (['PUBLIC', 'PRIVATE', 'TEAM'].includes(visibilityValue)) {
            visibility = visibilityValue
          }
        }

        // Parse tags
        let tags: string[] = []
        if (tagsIndex !== -1 && values[tagsIndex]) {
          tags = values[tagsIndex]
            .split(';')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0)
        }

        // Check if prompt with same title already exists for this user
        const existingPrompt = await prisma.prompt.findFirst({
          where: {
            title,
            owner_id: req.user!.userId,
            deleted_at: null
          }
        })

        if (existingPrompt) {
          results.errors.push(`Row ${i + 1}: Prompt with title "${title}" already exists`)
          results.skipped++
          continue
        }

        // Create or find tags
        const tagRecords = await Promise.all(
          tags.map(async (tagName: string) => {
            return prisma.tag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName }
            })
          })
        )

        // Create the prompt
        const prompt = await prisma.prompt.create({
          data: {
            title,
            prompt_text: promptText,
            visibility: visibility as 'PUBLIC' | 'PRIVATE' | 'TEAM',
            owner_id: req.user!.userId,
            created_by: req.user!.userId,
            tags: {
              connect: tagRecords.map(tag => ({ id: tag.id }))
            }
          }
        })

        // Create first version
        await prisma.promptVersion.create({
          data: {
            prompt_id: prompt.id,
            title,
            prompt_text: promptText,
            version: 1,
            created_by: req.user!.userId,
            tags: {
              connect: tagRecords.map(tag => ({ id: tag.id }))
            }
          }
        })

        results.imported++

      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        results.skipped++
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      results
    })

  } catch (error) {
    console.error('Import prompts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// Helper function to parse CSV line properly handling quoted values
function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i += 2
      } else {
        // Toggle quotes
        inQuotes = !inQuotes
        i++
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim())
      current = ''
      i++
    } else {
      current += char
      i++
    }
  }
  
  result.push(current.trim())
  return result
}