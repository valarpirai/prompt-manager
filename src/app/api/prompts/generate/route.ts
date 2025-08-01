import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest, llmRateLimit } from '@/lib/middleware'

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user!.userId.toString()
    
    if (!llmRateLimit(userId)) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. You can generate up to 10 prompts per hour.' 
      }, { status: 429 })
    }

    const { description, context = '' } = await req.json()

    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'LLM service not configured. Please add OPENAI_API_KEY to environment variables.' 
      }, { status: 503 })
    }

    const systemPrompt = `You are an expert AI prompt engineer. Your task is to create detailed, effective prompts for AI assistants based on user descriptions.

Guidelines:
1. Create clear, specific, and actionable prompts
2. Include relevant context and constraints
3. Use proper formatting and structure
4. Ensure the prompt will produce consistent, high-quality results
5. Keep prompts concise but comprehensive
6. Include examples when helpful

Return only the generated prompt text, without any additional commentary or explanation.`

    const userPrompt = `Create an AI prompt for: "${description}"${context ? `\n\nAdditional context: ${context}` : ''}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API error:', errorData)
      return NextResponse.json({ 
        error: 'Failed to generate prompt. Please try again later.' 
      }, { status: 500 })
    }

    const data = await response.json()
    const generatedPrompt = data.choices[0]?.message?.content?.trim()

    if (!generatedPrompt) {
      return NextResponse.json({ 
        error: 'Failed to generate prompt. Please try again.' 
      }, { status: 500 })
    }

    const suggestedTitle = description.length > 50 
      ? description.substring(0, 50) + '...' 
      : description

    const suggestedTags = extractTagsFromDescription(description)

    return NextResponse.json({
      generatedPrompt,
      suggestedTitle,
      suggestedTags,
      originalDescription: description
    })

  } catch (error) {
    console.error('Generate prompt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

function extractTagsFromDescription(description: string): string[] {
  const commonKeywords = [
    'code', 'review', 'javascript', 'python', 'java', 'react', 'node',
    'writing', 'content', 'marketing', 'email', 'blog', 'social',
    'analysis', 'data', 'research', 'summary', 'translation',
    'creative', 'story', 'poem', 'humor', 'professional',
    'technical', 'documentation', 'tutorial', 'guide', 'help'
  ]

  const tags: string[] = []
  const lowerDesc = description.toLowerCase()

  for (const keyword of commonKeywords) {
    if (lowerDesc.includes(keyword) && tags.length < 5) {
      tags.push(keyword)
    }
  }

  if (tags.length === 0) {
    if (lowerDesc.includes('code') || lowerDesc.includes('programming')) {
      tags.push('programming')
    } else if (lowerDesc.includes('write') || lowerDesc.includes('content')) {
      tags.push('writing')
    } else {
      tags.push('general')
    }
  }

  return tags
}