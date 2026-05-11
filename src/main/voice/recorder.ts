import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'

export class Recorder {
  private process: ChildProcess | null = null
  private outputPath: string
  private onData: (buffer: Buffer) => void

  constructor(onData: (buffer: Buffer) => void) {
    this.onData = onData
    this.outputPath = join(app.getPath('userData'), 'recording-temp.wav')
  }

  start(): void {
    if (this.process) return

    this.process = spawn('rec', [
      '-r',
      '16000',
      '-b',
      '16',
      '-c',
      '1',
      this.outputPath,
      'silence',
      '1',
      '0.2',
      '1.5%',
      '1',
      '1.5',
      '1.5%'
    ])

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.onData(chunk)
    })

    this.process.stderr?.on('data', (chunk: Buffer) => {
      // SoX outputs status/progress info to stderr
      this.onData(chunk)
    })

    this.process.on('error', (err) => {
      console.error('Recorder process error:', err)
      this.process = null
    })

    this.process.on('exit', (code) => {
      console.log(`Recorder process exited with code ${code}`)
      this.process = null
    })
  }

  stop(): string | null {
    if (!this.process) return null

    this.process.kill('SIGTERM')
    this.process = null
    return this.outputPath
  }

  get isRecording(): boolean {
    return this.process !== null
  }

  getOutputPath(): string {
    return this.outputPath
  }
}
