/**
 * Lightweight CLI spinner (no dependencies).
 * Writes to stderr so it doesn't interfere with stdout streaming.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private message = '';

  start(message: string): void {
    this.message = message;
    this.startTime = Date.now();
    this.frameIndex = 0;

    this.render();
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % FRAMES.length;
      this.render();
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Clear the spinner line
    process.stderr.write('\r\x1b[K');
  }

  private render(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    const frame = FRAMES[this.frameIndex];
    process.stderr.write(`\r\x1b[K\x1b[2m${frame} ${this.message} (${elapsed}s)\x1b[0m`);
  }
}
