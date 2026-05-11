import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function isSoxInstalled(): Promise<boolean> {
  try {
    await execAsync('which sox')
    return true
  } catch {
    return false
  }
}

export async function getSoxPath(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('which sox')
    return stdout.trim()
  } catch {
    return null
  }
}
