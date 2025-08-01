export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validatePromptTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title is required' }
  }

  if (title.length > 100) {
    return { valid: false, error: 'Title must be 100 characters or less' }
  }

  return { valid: true }
}

export function validatePromptText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Prompt text is required' }
  }

  return { valid: true }
}

export function validateTags(tags: string[]): { valid: boolean; error?: string } {
  if (tags.length > 10) {
    return { valid: false, error: 'Maximum 10 tags allowed' }
  }

  for (const tag of tags) {
    if (tag.length > 50) {
      return { valid: false, error: 'Each tag must be 50 characters or less' }
    }
  }

  return { valid: true }
}

export function validateTeamName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Team name is required' }
  }

  if (name.length > 100) {
    return { valid: false, error: 'Team name must be 100 characters or less' }
  }

  return { valid: true }
}