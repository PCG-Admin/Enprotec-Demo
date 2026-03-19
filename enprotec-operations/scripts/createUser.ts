import { handleCreateUser } from '../api/create-user'

const run = async () => {
  try {
    const payload = JSON.parse(process.argv[2] ?? '{}')
    const result = await handleCreateUser(payload)
    console.log(`Status: ${result.status}`)
    console.log(JSON.stringify(result.body, null, 2))
  } catch (error) {
    console.error('Failed to create user:', error)
    process.exit(1)
  }
}

run()

