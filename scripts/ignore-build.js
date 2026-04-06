const msg = (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').toLowerCase()

const skipKeywords = ['[skip]', '[wip]', '[no-deploy]']

if (skipKeywords.some(k => msg.includes(k))) {
  console.log('🚫 Skip build: matched keyword')
  process.exit(0)
}

// 기본: 빌드 진행
console.log('✅ Proceed build')
process.exit(1)