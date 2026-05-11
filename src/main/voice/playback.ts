import { spawn, ChildProcess } from 'child_process'

export class Playback {
  private process: ChildProcess | null = null

  async playPCMStream(pcmStream: AsyncIterable<Buffer>): Promise<void> {
    if (this.process) {
      this.stop()
    }

    this.process = spawn('play', [
      '-r',
      '16000',
      '-b',
      '16',
      '-c',
      '1',
      '-t',
      'raw',
      '-e',
      'signed',
      '-'
    ])

    this.process.on('error', (err) => {
      console.error('Playback process error:', err)
      this.process = null
    })

    this.process.on('exit', (code) => {
      console.log(`Playback process exited with code ${code}`)
      this.process = null
    })

    const stdin = this.process.stdin
    if (!stdin) {
      throw new Error('Failed to open stdin for playback process')
    }

    try {
      for await (const chunk of pcmStream) {
        if (!this.process) break
        await new Promise<void>((resolve, reject) => {
          stdin.write(chunk, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
      stdin.end()
    } catch (err) {
      stdin.destroy()
      throw err
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }

  get isPlaying(): boolean {
    return this.process !== null
  }
}
